// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {EctoplasmVault} from "../src/EctoplasmVault.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {MockAprMON} from "./mocks/MockAprMON.sol";

contract EctoplasmVaultTest is Test {
    EctoplasmVault vault;
    SubscriptionManager subManager;
    MockAprMON aprMON;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address merchant = makeAddr("merchant");

    uint256 constant DEPOSIT_AMOUNT = 100 ether;

    function setUp() public {
        aprMON = new MockAprMON();

        vm.startPrank(owner);
        vault = new EctoplasmVault(address(aprMON), owner);
        subManager = new SubscriptionManager(address(vault), owner);
        vault.setSubscriptionManager(address(subManager));
        vm.stopPrank();

        // Give alice some aprMON
        aprMON.mint(alice, DEPOSIT_AMOUNT);
    }

    // ── Deposit tests ────────────────────────────────────────────────────

    function test_deposit() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        (uint256 shares, uint256 principal,) = vault.accounts(alice);
        assertEq(shares, DEPOSIT_AMOUNT);
        assertEq(principal, DEPOSIT_AMOUNT); // 1:1 rate at start
        assertEq(aprMON.balanceOf(address(vault)), DEPOSIT_AMOUNT);
    }

    function test_deposit_revert_zero() public {
        vm.prank(alice);
        vm.expectRevert(EctoplasmVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    // ── Withdraw tests ───────────────────────────────────────────────────

    function test_withdraw() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);

        vault.withdraw(50 ether);
        vm.stopPrank();

        (uint256 shares, uint256 principal,) = vault.accounts(alice);
        assertEq(shares, 50 ether);
        assertEq(principal, 50 ether);
        assertEq(aprMON.balanceOf(alice), 50 ether);
    }

    function test_withdraw_revert_insufficient() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);

        vm.expectRevert(
            abi.encodeWithSelector(EctoplasmVault.InsufficientShares.selector, DEPOSIT_AMOUNT, DEPOSIT_AMOUNT + 1)
        );
        vault.withdraw(DEPOSIT_AMOUNT + 1);
        vm.stopPrank();
    }

    // ── Yield accounting tests ───────────────────────────────────────────

    function test_yield_accrues_when_rate_increases() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate yield: 1 aprMON = 1.1 MON (10% yield)
        aprMON.setExchangeRate(110, 100);

        uint256 currentVal = vault.currentValueInMON(alice);
        assertEq(currentVal, 110 ether); // 100 shares * 1.1

        uint256 yield_ = vault.availableYield(alice);
        assertEq(yield_, 10 ether); // 110 - 100 principal
    }

    function test_no_yield_when_rate_unchanged() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        uint256 yield_ = vault.availableYield(alice);
        assertEq(yield_, 0);
    }

    function test_yield_after_partial_withdraw() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // 10% yield
        aprMON.setExchangeRate(110, 100);

        vm.prank(alice);
        vault.withdraw(50 ether); // withdraw 50 shares

        // Remaining: 50 shares, principal reduced pro-rata to 50 MON
        // Current value: 50 * 1.1 = 55 MON
        // Yield: 55 - 50 = 5 MON
        uint256 yield_ = vault.availableYield(alice);
        assertEq(yield_, 5 ether);
    }

    // ── SpendYield access control ────────────────────────────────────────

    function test_spendYield_revert_not_manager() public {
        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        aprMON.setExchangeRate(110, 100);

        vm.prank(alice);
        vm.expectRevert(EctoplasmVault.OnlySubscriptionManager.selector);
        vault.spendYield(alice, 5 ether, merchant);
    }

    // ── Pause tests ──────────────────────────────────────────────────────

    function test_pause_blocks_deposit() public {
        vm.prank(owner);
        vault.pause();

        vm.startPrank(alice);
        aprMON.approve(address(vault), DEPOSIT_AMOUNT);
        vm.expectRevert();
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    // ── Admin tests ──────────────────────────────────────────────────────

    function test_setSubscriptionManager() public {
        address newManager = makeAddr("newManager");
        vm.prank(owner);
        vault.setSubscriptionManager(newManager);
        assertEq(vault.subscriptionManager(), newManager);
    }

    function test_setSubscriptionManager_revert_not_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setSubscriptionManager(makeAddr("x"));
    }
}
