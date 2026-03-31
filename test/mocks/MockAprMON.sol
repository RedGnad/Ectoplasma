// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockAprMON
/// @notice Simplified mock of aPriori's aprMON for testing. Simulates a reward-bearing
///         token where the exchange rate (shares→assets) increases over time.
contract MockAprMON is ERC20 {
    // 1 share = (_exchangeRateNumerator / _exchangeRateDenominator) assets
    uint256 private _exchangeRateNumerator;
    uint256 private _exchangeRateDenominator;

    constructor() ERC20("Mock aprMON", "aprMON") {
        _exchangeRateNumerator = 1e18;
        _exchangeRateDenominator = 1e18;
    }

    // ── Minting for tests ────────────────────────────────────────────────

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // ── Exchange rate simulation ─────────────────────────────────────────

    /// @notice Set exchange rate. e.g. setExchangeRate(105, 100) means 1 share = 1.05 MON.
    function setExchangeRate(uint256 numerator, uint256 denominator) external {
        _exchangeRateNumerator = numerator;
        _exchangeRateDenominator = denominator;
    }

    // ── ERC-4626-like view functions ─────────────────────────────────────

    function asset() external pure returns (address) {
        return address(0); // native MON
    }

    function totalAssets() external view returns (uint256) {
        return (totalSupply() * _exchangeRateNumerator) / _exchangeRateDenominator;
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return (shares * _exchangeRateNumerator) / _exchangeRateDenominator;
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return (assets * _exchangeRateDenominator) / _exchangeRateNumerator;
    }

    function previewDeposit(uint256 assets) external view returns (uint256) {
        return (assets * _exchangeRateDenominator) / _exchangeRateNumerator;
    }

    function previewMint(uint256 shares) external view returns (uint256) {
        return (shares * _exchangeRateNumerator) / _exchangeRateDenominator;
    }

    function previewRedeem(uint256 shares) external view returns (uint256) {
        return (shares * _exchangeRateNumerator) / _exchangeRateDenominator;
    }

    function previewWithdraw(uint256 assets) external view returns (uint256) {
        return (assets * _exchangeRateDenominator) / _exchangeRateNumerator;
    }

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return (balanceOf(owner) * _exchangeRateNumerator) / _exchangeRateDenominator;
    }

    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    // ── Deposit (simplified for tests) ───────────────────────────────────

    function deposit(uint256 assets, address receiver) external payable returns (uint256 shares) {
        shares = (assets * _exchangeRateDenominator) / _exchangeRateNumerator;
        _mint(receiver, shares);
    }

    function mint(uint256 shares, address receiver) external payable returns (uint256 assets) {
        assets = (shares * _exchangeRateNumerator) / _exchangeRateDenominator;
        _mint(receiver, shares);
    }
}
