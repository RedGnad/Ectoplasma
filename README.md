Ectoplasma – Stake‑to‑Subscribe Vault on Casper
1. Problem
Subscriptions today rely on opaque, off‑chain billing:

Users pre‑authorize recurring debit on their bank card.
Merchants rely on custodians or payment processors.
There is no on‑chain native way to:
hold a subscription balance,
pay merchants on a schedule,
and optionally fund payments from staking yield.
For Web3 users on Casper, this means:

CSPR is often idle in wallets.
Subscriptions to Web2 services (Netflix, Spotify, gift cards, etc.) are not natively connected to on‑chain balances.
Developers must rebuild billing logic off‑chain, losing auditability.
Ectoplasma explores how on‑chain vaults on Casper can power recurring payments, while remaining compatible with Web2 payment providers.

2. High‑Level Overview
Ectoplasma is a non‑custodial subscription vault:

Users deposit CSPR into a dedicated smart contract (the vault).
Merchants publish subscription plans (price per period, period length).
The contract tracks subscriptions and can pay merchants from the user’s vault balance.
A frontend dApp lets users:
connect a Casper wallet (via CSPR.click),
deposit into the vault,
subscribe to demo plans (Netflix / Spotify),
inspect their vault and subscription status.
A backend API sketch shows how on‑chain billing could be bridged to Web2 gift card providers (Bitrefill) in production.
The prototype runs on Casper testnet and targets hackathon evaluation, not production use.

3. Architecture
On‑chain (Odra smart contract)
Language / framework: Rust + Odra (Casper backend).
Core contract: Ectoplasma (see src/ectoplasma.rs).
Key storage:
user_balance: Mapping<Address, U512> – vault balance per user.
Plan data (price, period, metadata).
Subscription data (subscriber, plan, active flag, periods paid).
Events:
PlanCreated, Subscribed, SubscriptionCanceled, BillingProcessed.
Frontend dApp
Framework: Next.js (App Router) + TypeScript + Tailwind CSS.
Wallet integration: CSPR.click JS SDK (Casper Wallet / Casper Signer).
UI:
User panel: connect wallet, view vault balance, demo deposit presets, subscribe to Netflix/Spotify, see demo subscription cards.
Merchant panel: create plans (price/duration), view existing plans (future work).
Network: Casper testnet (RPC: 65.109.83.79:7777).
Backend / API routes
Next.js API routes (App Router):

/api/wallet-balance – proxy to Casper RPC query_balance.
/api/staked-balance – 
/api/external-subscription – stub for a Web2 bridge (e.g. Bitrefill Thor API) that would receive fiat amount, provider, user public key, etc.

4. Smart Contract Design
rust
#[odra::module]
impl Ectoplasma {
    #[odra(payable)]
    pub fn deposit(&mut self) { /* ... */ }
    pub fn create_plan(
        &mut self,
        price_per_period: U512,
        period_secs: u64,
        name: String,
        description: String,
    ) -> PlanId { /* ... */ }
    pub fn subscribe(&mut self, plan_id: PlanId) -> SubscriptionId { /* ... */ }
    pub fn process_billing(&mut self, subscription_id: SubscriptionId) { /* ... */ }
    pub fn cancel_subscription(&mut self, subscription_id: SubscriptionId) { /* ... */ }
    // View helpers: get_balance, get_plan_financial, get_plan_metadata, etc.
}
Key behaviors:

Deposit
Payable entrypoint; amount = env().attached_value().
Increases user_balance[caller].
create_plan
Only callable by a merchant account.
Stores price, period length (seconds), name, description.
Emits PlanCreated.
subscribe
Records subscription_id → {subscriber, plan_id, active}.
Does not pull funds immediately; billing is decoupled.
Emits Subscribed.
process_billing
Checks subscription alive and plan active.
Reads price_per_period, user_balance[subscriber].
If sufficient balance:
Decrements user balance.
Transfers tokens to merchant.
Increments sub_periods_paid.
Emits BillingProcessed.
cancel_subscription
Only subscriber can cancel; sets active = false.
Emits SubscriptionCanceled.
This design keeps:

funding (deposit) and billing (process_billing) separate,
logic fully on‑chain and auditable via events.
5. Frontend & Wallet Integration
The dApp uses CSPR.click to:
connect a Casper wallet,
construct deploys for deposit, create_plan, subscribe via a proxy caller WASM,
sign and send deploys on Casper testnet.
UX highlights:
Preset deposit chips (1 CSPR test, 2.5k / 5k / 10k CSPR, “Gold” tiers).
Netflix/Spotify subscribe CTAs with clear visual feedback:
status messages only set when the deploy is confirmed as processed.
Demo “My subscriptions” cards summarizing:
subscription ID,
plan price / frequency,
next billing date (demo),
Web2 bridge information.

6. Web2 Bridge (Bitrefill) 

The /api/external-subscription route models how a production integration could work:

Receive:
provider (e.g. "netflix", "spotify"),
fiat amount, currency,
user’s Casper public key.
Create a Thor API order with Bitrefill using BITREFILL_API_KEY / BITREFILL_API_SECRET.
Pay from a hot wallet funded by the vault’s yield or a dedicated treasury.
Store order ID and status on‑chain or in an indexer for reconciliation.
In this hackathon prototype:

7. How to Run Locally
Smart contract (Odra)
bash
# Build contract
cargo odra build -b casper
# Run tests
cargo odra test -b casper
Frontend dApp
bash
cd frontend
npm install
npm run dev
# visit http://localhost:3000
Environment:

Casper testnet RPC endpoint is configured in the frontend.
CSPR.click is loaded via CDN with showTopBar: false to let the custom header drive the UX.
8. Limitations & Future Work
Current limitations:

No on‑chain indexer wired into the dApp:
“Staked balance” is a documented placeholder.
No advanced risk controls (rate limits, minimum balances, etc.).
Future directions:

Integrate with a Casper indexer for rich historical views.
Add a scheduling layer (off‑chain cron) to call process_billing automatically.
Finalize the Bitrefill Thor integration for real orders on mainnet.
Extend the plan model (trial periods, discounts, family plans).
Security review and formal verification of billing invariants.
