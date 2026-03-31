// Contract addresses — set via environment variables after deployment
export const VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`) || "0x";
export const SUBSCRIPTION_MANAGER_ADDRESS =
  (process.env.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS as `0x${string}`) ||
  "0x";
export const APRMON_ADDRESS =
  (process.env.NEXT_PUBLIC_APRMON_ADDRESS as `0x${string}`) ||
  "0x0c65A0BC65a5D819235B71F554D210D3F80E0852";

// ABI fragments — only the functions we call from the frontend
export const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "accounts",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "sharesDeposited", type: "uint256" },
      { name: "principalInMON", type: "uint256" },
      { name: "yieldWithdrawn", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "currentValueInMON",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "availableYield",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const SUBSCRIPTION_MANAGER_ABI = [
  {
    type: "function",
    name: "createPlan",
    inputs: [
      { name: "pricePerPeriod", type: "uint256" },
      { name: "periodSeconds", type: "uint256" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "planId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "subscribe",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [{ name: "subscriptionId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelSubscription",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "processBilling",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPlanDetails",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [
      { name: "merchant", type: "address" },
      { name: "pricePerPeriod", type: "uint256" },
      { name: "periodSeconds", type: "uint256" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "active", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSubscriptionDetails",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [
      { name: "subscriber", type: "address" },
      { name: "planId", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "startTimestamp", type: "uint256" },
      { name: "lastBilledTimestamp", type: "uint256" },
      { name: "periodsPaid", type: "uint32" },
      { name: "nextBillingTimestamp", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserSubscriptions",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMerchantPlans",
    inputs: [{ name: "merchant", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isBillingDue",
    inputs: [{ name: "subscriptionId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextPlanId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;
