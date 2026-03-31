// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {EctoplasmVault} from "../src/EctoplasmVault.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";

/// @notice Deploy Ectoplasma contracts on Monad.
/// @dev Usage:
///   forge script script/Deploy.s.sol:DeployEctoplasma \
///     --rpc-url $MONAD_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast
contract DeployEctoplasma is Script {
    // aprMON mainnet address (aPriori)
    address constant APRMON_MAINNET = 0x0c65A0BC65a5D819235B71F554D210D3F80E0852;

    function run() external {
        address deployer = msg.sender;
        address aprMONAddress = vm.envOr("APRMON_ADDRESS", APRMON_MAINNET);

        console.log("Deployer:", deployer);
        console.log("aprMON:", aprMONAddress);

        vm.startBroadcast();

        // 1. Deploy vault
        EctoplasmVault vault = new EctoplasmVault(aprMONAddress, deployer);
        console.log("EctoplasmVault deployed at:", address(vault));

        // 2. Deploy subscription manager
        SubscriptionManager subManager = new SubscriptionManager(address(vault), deployer);
        console.log("SubscriptionManager deployed at:", address(subManager));

        // 3. Wire them together
        vault.setSubscriptionManager(address(subManager));
        console.log("SubscriptionManager set on vault");

        vm.stopBroadcast();
    }
}
