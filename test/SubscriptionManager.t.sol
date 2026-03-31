// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {EctoplasmVault} from "../src/EctoplasmVault.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {MockAprMON} from "./mocks/MockAprMON.sol";

contract SubscriptionManagerTest is Test {
    EctoplasmVault vault;
    SubscriptionManager subManager;
    MockAprMON aprMON;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address merchant = makeAddr("merchant");
    address keeper = makeAddr("keeper");

    uint256 constant DEPOSIT_AMOUNT = 1000 ether;
    uint256 constant PLAN_PRICE = 10 ether;      // 10 MON per period
    uint256 constant PLAN_PERIOD = 30 days;

    function setUp() public {
        aprMON = new MockAprMON();

        vm.startPrank(owner);
        vault = new EctoplasmVault(address(aprMON), owner);
        subManager = new SubscriptionManager(address(vault), owner);
        vault.setSubscriptionManager(address(subManager));
        vm.stopPrank();

        // Fund alice
        aprMON.mint(alice, DEPOSIT_AMOUNT);
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    // ── Plan creation ────────────────────────────────────────────────────

    function test_createPlan() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "Monthly streaming");

        (
            address m,
            uint256 price,
            uint256 period,
            string memory name,
            string memory desc,
            bool active
        ) = subManager.getPlanDetails(planId);

        assertEq(m, merchant);
        assertEq(price, PLAN_PRICE);
        assertEq(period, PLAN_PERIOD);
        assertEq(name, "Netflix");
        assertEq(desc, "Monthly streaming");
        assertTrue(active);
    }

    function test_createPlan_revert_zero_price() public {
        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.ZeroAmount.selector);
        subManager.createPlan(0, PLAN_PERIOD, "Bad", "");
    }

    function test_createPlan_revert_zero_period() public {
        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.ZeroPeriod.selector);
        subManager.createPlan(PLAN_PRICE, 0, "Bad", "");
    }

    function test_setPlanActive() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");

        vm.prank(merchant);
        subManager.setPlanActive(planId, false);

        (,,,,, bool active) = subManager.getPlanDetails(planId);
        assertFalse(active);
    }

    function test_setPlanActive_revert_not_merchant() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.NotMerchant.selector);
        subManager.setPlanActive(planId, false);
    }

    // ── Subscribe ────────────────────────────────────────────────────────

    function test_subscribe() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");

        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        (
            address subscriber,
            uint256 sPlanId,
            bool active,
            uint256 startTs,
            uint256 lastBilled,
            uint32 periodsPaid,
            uint256 nextBilling
        ) = subManager.getSubscriptionDetails(subId);

        assertEq(subscriber, alice);
        assertEq(sPlanId, planId);
        assertTrue(active);
        assertEq(startTs, block.timestamp);
        assertEq(lastBilled, block.timestamp);
        assertEq(periodsPaid, 0);
        assertEq(nextBilling, block.timestamp + PLAN_PERIOD);
    }

    function test_subscribe_revert_inactive_plan() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(merchant);
        subManager.setPlanActive(planId, false);

        vm.prank(alice);
        vm.expectRevert(SubscriptionManager.PlanNotActive.selector);
        subManager.subscribe(planId);
    }

    function test_cancelSubscription() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        vm.prank(alice);
        subManager.cancelSubscription(subId);

        (,, bool active,,,,) = subManager.getSubscriptionDetails(subId);
        assertFalse(active);
    }

    function test_cancelSubscription_revert_not_subscriber() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        vm.prank(merchant);
        vm.expectRevert(SubscriptionManager.NotSubscriber.selector);
        subManager.cancelSubscription(subId);
    }

    // ── Billing ──────────────────────────────────────────────────────────

    function test_processBilling_single_period() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        // Simulate yield accrual: 10% yield → 100 MON yield on 1000 deposit
        aprMON.setExchangeRate(110, 100);

        // Advance time past one period
        vm.warp(block.timestamp + PLAN_PERIOD);

        // Keeper calls billing
        vm.prank(keeper);
        subManager.processBilling(subId);

        (,,,, uint256 lastBilled, uint32 periodsPaid,) = subManager.getSubscriptionDetails(subId);
        assertEq(periodsPaid, 1);

        // Merchant received aprMON shares
        // 10 MON at rate 1.1 → ~9.09 shares
        uint256 merchantBalance = aprMON.balanceOf(merchant);
        assertGt(merchantBalance, 0);
    }

    function test_processBilling_revert_not_due() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        aprMON.setExchangeRate(110, 100);

        // Don't advance time
        vm.prank(keeper);
        vm.expectRevert(SubscriptionManager.BillingNotDue.selector);
        subManager.processBilling(subId);
    }

    function test_processBilling_insufficient_yield_emits_event() public {
        vm.prank(merchant);
        // Very expensive plan: 2000 MON/period (more than any possible yield)
        uint256 planId = subManager.createPlan(2000 ether, PLAN_PERIOD, "Expensive", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        // Only 10% yield = 100 MON, but plan costs 2000 MON
        aprMON.setExchangeRate(110, 100);
        vm.warp(block.timestamp + PLAN_PERIOD);

        vm.prank(keeper);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionManager.BillingFailed(subId, alice, "INSUFFICIENT_YIELD");
        subManager.processBilling(subId);

        // Periods paid should still be 0
        (,,,,, uint32 periodsPaid,) = subManager.getSubscriptionDetails(subId);
        assertEq(periodsPaid, 0);
    }

    function test_processBilling_multiple_periods() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        // 20% yield → 200 MON yield
        aprMON.setExchangeRate(120, 100);

        // Advance 3 periods
        vm.warp(block.timestamp + PLAN_PERIOD * 3);

        vm.prank(keeper);
        subManager.processBilling(subId);

        (,,,,, uint32 periodsPaid,) = subManager.getSubscriptionDetails(subId);
        assertEq(periodsPaid, 3);
    }

    function test_processBillingBatch() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");

        vm.prank(alice);
        uint256 subId1 = subManager.subscribe(planId);

        // Give bob some tokens and subscribe too
        address bob = makeAddr("bob");
        aprMON.mint(bob, DEPOSIT_AMOUNT);
        vm.startPrank(bob);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        uint256 subId2 = subManager.subscribe(planId);
        vm.stopPrank();

        // Yield + time
        aprMON.setExchangeRate(110, 100);
        vm.warp(block.timestamp + PLAN_PERIOD);

        // Batch billing
        uint256[] memory ids = new uint256[](2);
        ids[0] = subId1;
        ids[1] = subId2;

        vm.prank(keeper);
        subManager.processBillingBatch(ids);

        (,,,,, uint32 pp1,) = subManager.getSubscriptionDetails(subId1);
        (,,,,, uint32 pp2,) = subManager.getSubscriptionDetails(subId2);
        assertEq(pp1, 1);
        assertEq(pp2, 1);
    }

    // ── View helpers ─────────────────────────────────────────────────────

    function test_isBillingDue() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        vm.prank(alice);
        uint256 subId = subManager.subscribe(planId);

        assertFalse(subManager.isBillingDue(subId));

        vm.warp(block.timestamp + PLAN_PERIOD);
        assertTrue(subManager.isBillingDue(subId));
    }

    function test_getUserSubscriptions() public {
        vm.prank(merchant);
        uint256 planId = subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");

        vm.startPrank(alice);
        subManager.subscribe(planId);
        subManager.subscribe(planId);
        vm.stopPrank();

        uint256[] memory subs = subManager.getUserSubscriptions(alice);
        assertEq(subs.length, 2);
    }

    function test_getMerchantPlans() public {
        vm.startPrank(merchant);
        subManager.createPlan(PLAN_PRICE, PLAN_PERIOD, "Netflix", "");
        subManager.createPlan(PLAN_PRICE * 2, PLAN_PERIOD, "Spotify", "");
        vm.stopPrank();

        uint256[] memory planIds = subManager.getMerchantPlans(merchant);
        assertEq(planIds.length, 2);
    }
}
