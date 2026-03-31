// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {EctoplasmVault} from "./EctoplasmVault.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SubscriptionManager
/// @notice Manages merchant plans and user subscriptions on top of EctoplasmVault.
///         Billing pulls yield from the user's vault account and sends aprMON to merchant.
/// @dev Designed to be called by an off-chain keeper or manually.
contract SubscriptionManager is Ownable, Pausable, ReentrancyGuard {

    struct Plan {
        address merchant;
        uint256 pricePerPeriod;
        uint256 periodSeconds;
        string name;
        string description;
        bool active;
    }

    struct Subscription {
        address subscriber;
        uint256 planId;
        bool active;
        uint256 startTimestamp;
        uint256 lastBilledTimestamp;
        uint32 periodsPaid;
    }

    EctoplasmVault public immutable vault;

    uint256 public nextPlanId;
    uint256 public nextSubscriptionId;

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Subscription) public subscriptions;
    mapping(address => uint256[]) internal _userSubscriptions;
    mapping(address => uint256[]) internal _merchantPlans;

    event PlanCreated(
        uint256 indexed planId, address indexed merchant, uint256 pricePerPeriod, uint256 periodSeconds
    );
    event PlanUpdated(uint256 indexed planId, bool active);
    event Subscribed(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber);
    event SubscriptionCanceled(uint256 indexed subscriptionId, address indexed subscriber);
    event BillingProcessed(
        uint256 indexed subscriptionId,
        uint256 indexed planId,
        address indexed subscriber,
        address merchant,
        uint256 periodIndex,
        uint256 monAmount
    );
    event BillingFailed(uint256 indexed subscriptionId, address indexed subscriber, string reason);

    error ZeroAmount();
    error PlanNotFound();
    error PlanNotActive();
    error SubscriptionNotFound();
    error SubscriptionNotActive();
    error NotSubscriber();
    error NotMerchant();
    error BillingNotDue();
    error ZeroAddress();
    error ZeroPeriod();

    constructor(address _vault, address _owner) Ownable(_owner) {
        if (_vault == address(0)) revert ZeroAddress();
        vault = EctoplasmVault(_vault);
    }

    // ── Plan management ──────────────────────────────────────────────────

    function createPlan(
        uint256 pricePerPeriod,
        uint256 periodSeconds,
        string calldata name,
        string calldata description
    ) external whenNotPaused returns (uint256 planId) {
        if (pricePerPeriod == 0) revert ZeroAmount();
        if (periodSeconds == 0) revert ZeroPeriod();

        planId = nextPlanId++;
        plans[planId] = Plan({
            merchant: msg.sender,
            pricePerPeriod: pricePerPeriod,
            periodSeconds: periodSeconds,
            name: name,
            description: description,
            active: true
        });
        _merchantPlans[msg.sender].push(planId);
        emit PlanCreated(planId, msg.sender, pricePerPeriod, periodSeconds);
    }

    function setPlanActive(uint256 planId, bool active) external {
        Plan storage plan = plans[planId];
        if (plan.merchant == address(0)) revert PlanNotFound();
        if (plan.merchant != msg.sender) revert NotMerchant();
        plan.active = active;
        emit PlanUpdated(planId, active);
    }

    // ── Subscription lifecycle ───────────────────────────────────────────

    function subscribe(uint256 planId) external whenNotPaused returns (uint256 subscriptionId) {
        Plan storage plan = plans[planId];
        if (plan.merchant == address(0)) revert PlanNotFound();
        if (!plan.active) revert PlanNotActive();

        subscriptionId = nextSubscriptionId++;
        subscriptions[subscriptionId] = Subscription({
            subscriber: msg.sender,
            planId: planId,
            active: true,
            startTimestamp: block.timestamp,
            lastBilledTimestamp: block.timestamp,
            periodsPaid: 0
        });
        _userSubscriptions[msg.sender].push(subscriptionId);
        emit Subscribed(subscriptionId, planId, msg.sender);
    }

    function cancelSubscription(uint256 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        if (sub.subscriber == address(0)) revert SubscriptionNotFound();
        if (sub.subscriber != msg.sender) revert NotSubscriber();
        if (!sub.active) revert SubscriptionNotActive();
        sub.active = false;
        emit SubscriptionCanceled(subscriptionId, msg.sender);
    }

    // ── Billing ──────────────────────────────────────────────────────────

    /// @notice Process billing for a subscription. Anyone can call (keeper-friendly).
    /// @dev Checks that at least one full period has elapsed since last billing,
    ///      then pulls yield from the vault. If yield is insufficient, emits
    ///      BillingFailed instead of reverting so batch billing doesn't break.
    function processBilling(uint256 subscriptionId) external nonReentrant whenNotPaused {
        Subscription storage sub = subscriptions[subscriptionId];
        if (sub.subscriber == address(0)) revert SubscriptionNotFound();
        if (!sub.active) revert SubscriptionNotActive();

        Plan storage plan = plans[sub.planId];
        if (!plan.active) revert PlanNotActive();

        uint256 elapsed = block.timestamp - sub.lastBilledTimestamp;
        if (elapsed < plan.periodSeconds) revert BillingNotDue();

        // Calculate how many full periods are due
        uint256 periodsDue = elapsed / plan.periodSeconds;
        uint256 totalAmount = plan.pricePerPeriod * periodsDue;

        // Check available yield
        uint256 yield_ = vault.availableYield(sub.subscriber);
        if (yield_ < totalAmount) {
            emit BillingFailed(subscriptionId, sub.subscriber, "INSUFFICIENT_YIELD");
            return;
        }

        // Pull yield from vault → merchant
        vault.spendYield(sub.subscriber, totalAmount, plan.merchant);

        sub.lastBilledTimestamp += plan.periodSeconds * periodsDue;
        uint32 newPeriods = uint32(periodsDue);
        sub.periodsPaid += newPeriods;

        emit BillingProcessed(
            subscriptionId,
            sub.planId,
            sub.subscriber,
            plan.merchant,
            sub.periodsPaid,
            totalAmount
        );
    }

    /// @notice Batch-process billing for multiple subscriptions (keeper-optimized).
    function processBillingBatch(uint256[] calldata subscriptionIds) external {
        for (uint256 i = 0; i < subscriptionIds.length; i++) {
            // Use try/catch pattern: if one fails, continue with the rest
            try this.processBilling(subscriptionIds[i]) {} catch {}
        }
    }

    // ── View helpers ─────────────────────────────────────────────────────

    function getUserSubscriptions(address user) external view returns (uint256[] memory) {
        return _userSubscriptions[user];
    }

    function getMerchantPlans(address merchant) external view returns (uint256[] memory) {
        return _merchantPlans[merchant];
    }

    function getSubscriptionDetails(uint256 subscriptionId)
        external
        view
        returns (
            address subscriber,
            uint256 planId,
            bool active,
            uint256 startTimestamp,
            uint256 lastBilledTimestamp,
            uint32 periodsPaid,
            uint256 nextBillingTimestamp
        )
    {
        Subscription storage sub = subscriptions[subscriptionId];
        Plan storage plan = plans[sub.planId];
        return (
            sub.subscriber,
            sub.planId,
            sub.active,
            sub.startTimestamp,
            sub.lastBilledTimestamp,
            sub.periodsPaid,
            sub.lastBilledTimestamp + plan.periodSeconds
        );
    }

    function getPlanDetails(uint256 planId)
        external
        view
        returns (
            address merchant,
            uint256 pricePerPeriod,
            uint256 periodSeconds,
            string memory name,
            string memory description,
            bool active
        )
    {
        Plan storage plan = plans[planId];
        return (plan.merchant, plan.pricePerPeriod, plan.periodSeconds, plan.name, plan.description, plan.active);
    }

    /// @notice Check if a subscription billing is due.
    function isBillingDue(uint256 subscriptionId) external view returns (bool) {
        Subscription storage sub = subscriptions[subscriptionId];
        if (!sub.active) return false;
        Plan storage plan = plans[sub.planId];
        if (!plan.active) return false;
        return (block.timestamp - sub.lastBilledTimestamp) >= plan.periodSeconds;
    }

    // ── Admin ────────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
