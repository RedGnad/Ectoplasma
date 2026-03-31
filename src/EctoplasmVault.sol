// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IAprMON} from "./interfaces/IAprMON.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title EctoplasmVault
/// @notice Yield-funded subscription vault on Monad. Users deposit aprMON (aPriori LST),
///         the yield accrues over time via the aprMON exchange rate, and subscriptions
///         are paid from the accumulated yield — never touching the principal.
/// @dev aprMON is a reward-bearing token: the quantity of shares stays constant but
///      their MON value increases. We track the deposited shares and the MON value at
///      deposit time to isolate principal from yield.
contract EctoplasmVault is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────────
    // Types
    // ──────────────────────────────────────────────────────────────────────

    struct UserAccount {
        uint256 sharesDeposited;     // Total aprMON shares deposited
        uint256 principalInMON;      // MON value at deposit time (sum of all deposits)
        uint256 yieldWithdrawn;      // Cumulative yield already consumed (billing)
    }

    // ──────────────────────────────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────────────────────────────

    IAprMON public immutable aprMON;

    mapping(address => UserAccount) public accounts;

    // ──────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 shares, uint256 monValue);
    event Withdrawn(address indexed user, uint256 shares, uint256 monValue);
    event YieldConsumed(address indexed user, uint256 shares, address indexed recipient, uint256 monValue);

    // ──────────────────────────────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────────────────────────────

    error ZeroAmount();
    error InsufficientYield(uint256 available, uint256 required);
    error InsufficientShares(uint256 available, uint256 required);
    error ZeroAddress();

    // ──────────────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────────────

    /// @param _aprMON Address of the aprMON contract on Monad.
    /// @param _owner  Initial owner of the vault (admin).
    constructor(address _aprMON, address _owner) Ownable(_owner) {
        if (_aprMON == address(0)) revert ZeroAddress();
        aprMON = IAprMON(_aprMON);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Deposit / Withdraw
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Deposit aprMON shares into the vault.
    /// @param shares Amount of aprMON to deposit.
    function deposit(uint256 shares) external nonReentrant whenNotPaused {
        if (shares == 0) revert ZeroAmount();

        uint256 monValue = aprMON.convertToAssets(shares);

        IERC20(address(aprMON)).safeTransferFrom(msg.sender, address(this), shares);

        UserAccount storage acct = accounts[msg.sender];
        acct.sharesDeposited += shares;
        acct.principalInMON += monValue;

        emit Deposited(msg.sender, shares, monValue);
    }

    /// @notice Withdraw aprMON shares from the vault (principal only).
    /// @dev The user can only withdraw shares whose current MON value minus already-
    ///      consumed yield does not exceed their tracked principal.
    /// @param shares Amount of aprMON to withdraw.
    function withdraw(uint256 shares) external nonReentrant whenNotPaused {
        if (shares == 0) revert ZeroAmount();

        UserAccount storage acct = accounts[msg.sender];
        if (shares > acct.sharesDeposited) {
            revert InsufficientShares(acct.sharesDeposited, shares);
        }

        uint256 monValue = aprMON.convertToAssets(shares);

        // Pro-rata reduction of principal
        uint256 principalReduction = (acct.principalInMON * shares) / acct.sharesDeposited;
        acct.sharesDeposited -= shares;
        acct.principalInMON -= principalReduction;

        IERC20(address(aprMON)).safeTransfer(msg.sender, shares);

        emit Withdrawn(msg.sender, shares, monValue);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Yield accounting (view)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Current total MON value of a user's deposited shares.
    function currentValueInMON(address user) public view returns (uint256) {
        return aprMON.convertToAssets(accounts[user].sharesDeposited);
    }

    /// @notice Available yield = currentValue - principal - yieldAlreadyConsumed.
    function availableYield(address user) public view returns (uint256) {
        UserAccount storage acct = accounts[user];
        if (acct.sharesDeposited == 0) return 0;

        uint256 currentMON = aprMON.convertToAssets(acct.sharesDeposited);
        uint256 consumed = acct.yieldWithdrawn;

        if (currentMON <= acct.principalInMON + consumed) return 0;
        return currentMON - acct.principalInMON - consumed;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Yield spending (called by SubscriptionManager)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Spend yield from a user's account. Only callable by authorized contracts.
    /// @dev The SubscriptionManager calls this during billing. The yield is converted
    ///      to aprMON shares and transferred to the recipient (merchant).
    /// @param user      The user whose yield is being spent.
    /// @param monAmount The MON-denominated amount to spend from yield.
    /// @param recipient The merchant receiving the aprMON shares.
    function spendYield(address user, uint256 monAmount, address recipient)
        external
        nonReentrant
        whenNotPaused
        onlySubscriptionManager
    {
        if (monAmount == 0) revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        uint256 yield_ = availableYield(user);
        if (yield_ < monAmount) {
            revert InsufficientYield(yield_, monAmount);
        }

        // Convert MON amount to aprMON shares at current rate
        uint256 sharesToTransfer = aprMON.convertToShares(monAmount);
        UserAccount storage acct = accounts[user];

        if (sharesToTransfer > acct.sharesDeposited) {
            revert InsufficientShares(acct.sharesDeposited, sharesToTransfer);
        }

        acct.sharesDeposited -= sharesToTransfer;
        acct.yieldWithdrawn += monAmount;

        IERC20(address(aprMON)).safeTransfer(recipient, sharesToTransfer);

        emit YieldConsumed(user, sharesToTransfer, recipient, monAmount);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Access control for SubscriptionManager
    // ──────────────────────────────────────────────────────────────────────

    address public subscriptionManager;

    event SubscriptionManagerUpdated(address indexed oldManager, address indexed newManager);

    error OnlySubscriptionManager();

    modifier onlySubscriptionManager() {
        if (msg.sender != subscriptionManager) revert OnlySubscriptionManager();
        _;
    }

    /// @notice Set the SubscriptionManager contract address.
    /// @param _manager Address of the SubscriptionManager.
    function setSubscriptionManager(address _manager) external onlyOwner {
        if (_manager == address(0)) revert ZeroAddress();
        address old = subscriptionManager;
        subscriptionManager = _manager;
        emit SubscriptionManagerUpdated(old, _manager);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Admin
    // ──────────────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
