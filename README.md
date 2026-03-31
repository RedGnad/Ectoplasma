# Ectoplasma — Yield-Funded Subscription Vault on Monad

Ectoplasma is a **stake-to-subscribe** protocol on Monad. Users deposit **aprMON** (aPriori's liquid staking token), the staking yield accrues automatically, and recurring subscriptions are paid **from the yield only** — the principal is never touched.

## Why?

The Monad ecosystem is asking: *"If users hold yield-bearing tokens that stay liquid, what kinds of apps become possible?"*

Ectoplasma answers: **subscriptions funded by staking yield**. Your stMON pays for Netflix, Spotify, or any on-chain service — without spending your capital.

## Architecture

```
┌──────────────┐     deposit aprMON      ┌─────────────────┐
│    User      │ ──────────────────────→  │  EctoplasmVault │
│ (holds       │                          │                 │
│  aprMON)     │ ←────────────────────── │  tracks shares  │
│              │     withdraw aprMON      │  + principal    │
└──────────────┘                          │  + yield        │
                                          └────────┬────────┘
                                                   │ spendYield()
                                                   ▼
┌──────────────┐     createPlan()        ┌──────────────────────┐
│   Merchant   │ ──────────────────────→ │ SubscriptionManager  │
│              │                         │                      │
│              │ ←─── aprMON payment ─── │  plans[]             │
│              │                         │  subscriptions[]     │
└──────────────┘                         │  processBilling()    │
                                         └──────────────────────┘
                                                   ▲
                                                   │ processBilling()
                                          ┌────────┴────────┐
                                          │     Keeper      │
                                          │ (Gelato / cron) │
                                          └─────────────────┘
```

### How yield tracking works

aprMON is a **reward-bearing** token (not rebasing). The number of tokens stays constant, but each token's MON value increases over time via `convertToAssets()`.

- At deposit: we record `principalInMON = convertToAssets(shares)`
- Later: `availableYield = convertToAssets(shares) - principalInMON - yieldAlreadyConsumed`
- Billing converts the MON yield amount back to aprMON shares via `convertToShares()` and transfers them to the merchant

### Contracts

| Contract | Description |
|---|---|
| `EctoplasmVault` | Holds user aprMON deposits, tracks principal vs yield, exposes `spendYield()` |
| `SubscriptionManager` | Merchant plans, user subscriptions, billing logic, batch billing for keepers |
| `IAprMON` | Interface for aPriori's aprMON (ERC-20 + ERC-4626-like + async redemption) |

### Key addresses (Monad Mainnet)

| Contract | Address |
|---|---|
| aprMON (aPriori) | `0x0c65A0BC65a5D819235B71F554D210D3F80E0852` |
| Monad Chain ID | `143` |

## Development

### Prerequisites

- [Monad Foundry](https://docs.monad.xyz/tooling-and-infra/toolkits/monad-foundry) (custom Foundry fork with Monad gas model)

```bash
# Install Monad Foundry
curl -L https://foundry.category.xyz | bash
foundryup --network monad
```

### Setup

```bash
cd ectoplasma-monad
forge install
cp .env.example .env
```

### Build

```bash
forge build
```

### Test

```bash
forge test -vvv
```

### Deploy

```bash
# Local (anvil --monad)
anvil --monad
forge script script/Deploy.s.sol:DeployEctoplasma --rpc-url http://127.0.0.1:8545 --broadcast

# Monad Mainnet
forge script script/Deploy.s.sol:DeployEctoplasma \
  --rpc-url $MONAD_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

## Monad-specific notes

- **Gas is charged on `gas_limit`**, not `gas_used`. No refunds. Keep gas estimates tight.
- **400ms blocks, 800ms finality** — billing can be processed very frequently.
- **Parallel execution** is transparent to smart contract devs (transactions are still linearly ordered).
- **Max contract size**: 128KB. Max initcode: 256KB.
- Uses **viem >= 2.40.0** for frontend (includes `monad.ts` chain definition).

## Roadmap

- [x] Core vault contract (deposit/withdraw/yield tracking)
- [x] Subscription manager (plans/subscriptions/billing)
- [x] Batch billing for keepers
- [x] Comprehensive test suite
- [ ] Frontend dApp (Next.js + wagmi + viem)
- [ ] Gelato/keeper integration for automated billing
- [ ] Web2 bridge (Bitrefill) for real subscription fulfillment
- [ ] Multi-LST support (Kintsu, Magma, Fastlane)
- [ ] Security audit

## License

MIT
