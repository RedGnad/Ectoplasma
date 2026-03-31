// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title IAprMON
/// @notice Interface for aPriori's aprMON liquid staking token on Monad.
/// @dev aprMON is a reward-bearing token (not rebasing). The token quantity stays
///      constant but its value in MON increases over time as staking rewards accrue.
///      Based on official aPriori docs: https://apriori-docs.gitbook.io/apriori-docs/aprmon/smart-contract-integration
interface IAprMON {
    // ──────────────────────────────────────────────────────────────────────
    // ERC-20
    // ──────────────────────────────────────────────────────────────────────

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);

    // ──────────────────────────────────────────────────────────────────────
    // ERC-4626-like vault functions
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Returns the address of the underlying asset (native MON wrapper).
    function asset() external pure returns (address);

    /// @notice Total MON assets managed by the vault.
    function totalAssets() external view returns (uint256);

    /// @notice Convert aprMON shares to MON assets at current exchange rate.
    /// @param shares Amount of aprMON shares.
    /// @return assets Equivalent MON value.
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @notice Convert MON assets to aprMON shares at current exchange rate.
    /// @param assets Amount of MON.
    /// @return shares Equivalent aprMON shares.
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @notice Deposit MON and receive aprMON.
    /// @param assets Amount of MON to deposit.
    /// @param receiver Address that receives the aprMON shares.
    /// @return shares Amount of aprMON minted.
    function deposit(uint256 assets, address receiver) external payable returns (uint256 shares);

    /// @notice Mint a specific amount of aprMON shares.
    /// @param shares Amount of aprMON to mint.
    /// @param receiver Address that receives the aprMON shares.
    /// @return assets Amount of MON required.
    function mint(uint256 shares, address receiver) external payable returns (uint256 assets);

    /// @notice Preview the amount of shares for a given deposit.
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview the amount of assets for a given mint.
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /// @notice Preview the amount of shares for a given withdrawal.
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview the amount of assets for a given redeem.
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /// @notice Maximum deposit for a receiver.
    function maxDeposit(address receiver) external pure returns (uint256 maxAssets);

    /// @notice Maximum mint for a receiver.
    function maxMint(address receiver) external pure returns (uint256 maxShares);

    /// @notice Maximum withdrawal for an owner.
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);

    /// @notice Maximum redeem for an owner.
    function maxRedeem(address owner) external view returns (uint256 maxShares);

    // ──────────────────────────────────────────────────────────────────────
    // Async redemption (aPriori-specific)
    // ──────────────────────────────────────────────────────────────────────

    /// @notice Request a redemption of aprMON shares. Subject to epoch delay (12-18h).
    /// @param shares Amount of aprMON to redeem.
    /// @param controller Address controlling the request.
    /// @param owner Address owning the shares.
    /// @return requestId The redemption request identifier.
    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256 requestId);

    /// @notice Claim redeemed MON after the unlock epoch.
    /// @param requestIDs Array of request IDs to claim.
    /// @param receiver Address receiving the MON.
    function redeem(uint256[] calldata requestIDs, address receiver) external;

    /// @notice View details of a redemption request.
    function viewRedeemRequest(uint256 requestId)
        external
        view
        returns (
            uint256 id,
            bool claimed,
            bool claimable,
            uint256 shares,
            uint256 assets,
            uint256 timestamp,
            uint64 unlockEpoch
        );

    // ──────────────────────────────────────────────────────────────────────
    // ERC-2612 Permit
    // ──────────────────────────────────────────────────────────────────────

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
