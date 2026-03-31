"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState, useEffect } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  TrendingUp,
  CreditCard,
  Shield,
  Clock,
} from "lucide-react";
import {
  VAULT_ADDRESS,
  VAULT_ABI,
  APRMON_ADDRESS,
  ERC20_ABI,
  SUBSCRIPTION_MANAGER_ADDRESS,
  SUBSCRIPTION_MANAGER_ABI,
} from "@/config/contracts";

// ─── Helpers ─────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatMON(wei: bigint | undefined) {
  if (!wei) return "0.00";
  return Number(formatEther(wei)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

// ─── Components ──────────────────────────────────────────────────────

function ConnectButton() {
  return <appkit-button />;
}

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = "violet",
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "violet" | "emerald" | "sky";
}) {
  const ringMap = {
    violet: "ring-violet-500/40",
    emerald: "ring-emerald-500/40",
    sky: "ring-sky-500/40",
  };
  const textMap = {
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    sky: "text-sky-400",
  };
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 ring-1 ${ringMap[accent]}`}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        <Icon className={`h-3.5 w-3.5 ${textMap[accent]}`} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
        {value}
        <span className="ml-1 text-sm font-normal text-zinc-400">{unit}</span>
      </div>
    </div>
  );
}

function VaultDashboard() {
  const { address } = useAccount();
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");

  // Read vault account
  const { data: accountData, refetch: refetchAccount } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "accounts",
    args: address ? [address] : undefined,
    query: { enabled: !!address && VAULT_ADDRESS !== "0x" },
  });

  // Read available yield
  const { data: yieldData, refetch: refetchYield } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "availableYield",
    args: address ? [address] : undefined,
    query: { enabled: !!address && VAULT_ADDRESS !== "0x" },
  });

  // Read current MON value
  const { data: currentVal } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "currentValueInMON",
    args: address ? [address] : undefined,
    query: { enabled: !!address && VAULT_ADDRESS !== "0x" },
  });

  // Read aprMON balance
  const { data: aprMonBalance } = useReadContract({
    address: APRMON_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Write: approve + deposit
  const { writeContract: writeApprove, data: approveTx } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveTx });
  const { writeContract: writeDeposit, data: depositTx } = useWriteContract();
  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({ hash: depositTx });

  // Write: withdraw
  const { writeContract: writeWithdraw, data: withdrawTx } = useWriteContract();
  const { isSuccess: withdrawConfirmed } = useWaitForTransactionReceipt({ hash: withdrawTx });

  // Refetch on confirm
  useEffect(() => {
    if (depositConfirmed || withdrawConfirmed) {
      refetchAccount();
      refetchYield();
    }
  }, [depositConfirmed, withdrawConfirmed, refetchAccount, refetchYield]);

  // After approve confirmed, send deposit
  useEffect(() => {
    if (approveConfirmed && depositAmt) {
      writeDeposit({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [parseEther(depositAmt)],
      });
    }
  }, [approveConfirmed, depositAmt, writeDeposit]);

  const handleDeposit = () => {
    if (!depositAmt || !address) return;
    const amount = parseEther(depositAmt);
    writeApprove({
      address: APRMON_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, amount],
    });
  };

  const handleWithdraw = () => {
    if (!withdrawAmt || !address) return;
    writeWithdraw({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [parseEther(withdrawAmt)],
    });
  };

  const shares = accountData ? (accountData as [bigint, bigint, bigint])[0] : 0n;
  const principal = accountData ? (accountData as [bigint, bigint, bigint])[1] : 0n;

  const notDeployed = VAULT_ADDRESS === "0x";

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold tracking-tight">Your Vault</h2>

      {notDeployed && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          Contracts not deployed yet. Set <code>NEXT_PUBLIC_VAULT_ADDRESS</code> in{" "}
          <code>.env.local</code> after deployment.
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Deposited (aprMON)"
          value={formatMON(shares as bigint)}
          unit="aprMON"
          icon={Shield}
          accent="violet"
        />
        <StatCard
          label="Principal (MON)"
          value={formatMON(principal as bigint)}
          unit="MON"
          icon={CreditCard}
          accent="violet"
        />
        <StatCard
          label="Current Value"
          value={formatMON(currentVal as bigint | undefined)}
          unit="MON"
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          label="Available Yield"
          value={formatMON(yieldData as bigint | undefined)}
          unit="MON"
          icon={Zap}
          accent="emerald"
        />
      </div>

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Deposit */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowDownToLine className="h-4 w-4 text-violet-400" />
            Deposit aprMON
          </div>
          <p className="text-[11px] text-zinc-500">
            Wallet balance:{" "}
            <span className="text-zinc-300">
              {formatMON(aprMonBalance as bigint | undefined)} aprMON
            </span>
          </p>
          <input
            type="number"
            placeholder="Amount"
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <button
            onClick={handleDeposit}
            disabled={!depositAmt || !address || notDeployed}
            className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Deposit
          </button>
        </div>

        {/* Withdraw */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowUpFromLine className="h-4 w-4 text-emerald-400" />
            Withdraw aprMON
          </div>
          <p className="text-[11px] text-zinc-500">
            Deposited:{" "}
            <span className="text-zinc-300">
              {formatMON(shares as bigint)} aprMON
            </span>
          </p>
          <input
            type="number"
            placeholder="Amount"
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
          <button
            onClick={handleWithdraw}
            disabled={!withdrawAmt || !address || notDeployed}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Withdraw
          </button>
        </div>
      </div>
    </section>
  );
}

function SubscriptionSection() {
  const { address } = useAccount();

  const { data: userSubs } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS,
    abi: SUBSCRIPTION_MANAGER_ABI,
    functionName: "getUserSubscriptions",
    args: address ? [address] : undefined,
    query: { enabled: !!address && SUBSCRIPTION_MANAGER_ADDRESS !== "0x" },
  });

  const { data: nextPlanId } = useReadContract({
    address: SUBSCRIPTION_MANAGER_ADDRESS,
    abi: SUBSCRIPTION_MANAGER_ABI,
    functionName: "nextPlanId",
    query: { enabled: SUBSCRIPTION_MANAGER_ADDRESS !== "0x" },
  });

  const notDeployed = SUBSCRIPTION_MANAGER_ADDRESS === "0x";

  const subCount = userSubs ? (userSubs as bigint[]).length : 0;
  const planCount = nextPlanId ? Number(nextPlanId as bigint) : 0;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Subscriptions</h2>

      {notDeployed && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          Contracts not deployed yet. Set{" "}
          <code>NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS</code> in <code>.env.local</code>.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Your Subscriptions"
          value={String(subCount)}
          unit="active"
          icon={CreditCard}
          accent="violet"
        />
        <StatCard
          label="Available Plans"
          value={String(planCount)}
          unit="plans"
          icon={Clock}
          accent="sky"
        />
        <StatCard
          label="Billing"
          value="Auto"
          unit="via keepers"
          icon={Zap}
          accent="emerald"
        />
      </div>

      {/* Example subscription cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { name: "Netflix", img: "/logos/netflix.png", price: "~2.5", color: "violet" },
          { name: "Spotify", img: "/logos/spotify.png", price: "~1.2", color: "emerald" },
          { name: "Bitrefill", img: "/logos/bitrefill.png", price: "Variable", color: "sky" },
        ].map((svc) => (
          <div
            key={svc.name}
            className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4"
          >
            <img
              src={svc.img}
              alt={svc.name}
              className="h-10 w-10 rounded-lg object-contain"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{svc.name}</p>
              <p className="text-[11px] text-zinc-500">
                {svc.price} MON/month from yield
              </p>
            </div>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              Example
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600">
        * Brand names are illustrative examples. Web2 subscriptions will be bridged via
        Bitrefill in a future update.
      </p>
    </section>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function Home() {
  const { isConnected, address } = useAccount();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-zinc-50">
      {/* Background gradients */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.30)_0,transparent_55%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.22)_0,transparent_55%)]"
        aria-hidden="true"
      />

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logos/ectoplasma-logo.png"
              alt="Ectoplasma logo"
              className="h-10 w-10 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight">
                Ectoplasma
              </span>
              <span className="text-[11px] text-zinc-500">
                Yield-Funded Subscriptions on Monad
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isConnected && address && (
              <span className="hidden rounded-full bg-zinc-800 px-3 py-1 text-[11px] font-mono text-zinc-400 sm:inline-block">
                {shortAddr(address)}
              </span>
            )}
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
        {/* Hero */}
        <section className="relative max-w-3xl space-y-4">
          <div
            className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-72 w-[110%] -translate-x-1/2 bg-[radial-gradient(circle,rgba(139,92,246,0.35)_0,transparent_60%)]"
            aria-hidden="true"
          />
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Your staking yield pays your subscriptions.
          </h1>
          <p className="text-sm text-zinc-400 md:text-base">
            Deposit <strong className="text-zinc-200">aprMON</strong> into the
            Ectoplasma vault. Your principal stays untouched — only the staking
            yield generated by aPriori&apos;s liquid staking is used to pay
            recurring subscription fees.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]">
            <span className="rounded-full bg-violet-500/10 px-3 py-1 text-violet-300 ring-1 ring-violet-500/40">
              Monad Mainnet
            </span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 ring-1 ring-emerald-500/40">
              aprMON (aPriori)
            </span>
            <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300 ring-1 ring-zinc-700">
              ERC-4626 Yield
            </span>
          </div>

          {/* Floating logos */}
          <div
            className="absolute right-0 top-0 hidden flex-col items-end gap-3 md:flex"
            aria-hidden="true"
          >
            <img
              src="/logos/netflix.png"
              alt=""
              className="float-slow h-12 w-auto rounded-full bg-zinc-950/80 px-2 py-1 shadow-lg shadow-violet-500/30 ring-1 ring-zinc-700/80"
            />
            <img
              src="/logos/spotify.png"
              alt=""
              className="float-slow-delay h-12 w-auto rounded-full bg-zinc-950/80 px-2 py-1 shadow-lg shadow-emerald-500/30 ring-1 ring-zinc-700/80"
            />
            <img
              src="/logos/bitrefill.png"
              alt=""
              className="float-slow h-12 w-auto rounded-full bg-zinc-950/80 px-2 py-1 shadow-lg shadow-sky-500/30 ring-1 ring-zinc-700/80"
            />
          </div>
        </section>

        {/* How it works */}
        <section className="max-w-3xl space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
            How it works
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                1 · Connect
              </span>
              <p className="mt-1 text-[11px] md:text-xs text-zinc-400">
                Connect your wallet to Monad via Reown AppKit.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                2 · Deposit
              </span>
              <p className="mt-1 text-[11px] md:text-xs text-zinc-400">
                Deposit aprMON into the Ectoplasma vault. Your principal is tracked separately from yield.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                3 · Subscribe
              </span>
              <p className="mt-1 text-[11px] md:text-xs text-zinc-400">
                Subscribe to plans. Keepers auto-bill from your yield — your capital stays intact.
              </p>
            </div>
          </div>
        </section>

        {/* Network info bar */}
        <section className="max-w-3xl rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-[11px] text-zinc-300 md:text-xs">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Network
              </span>
              <span className="font-medium text-zinc-100">Monad (Chain ID: 143)</span>
              <span className="text-[10px] text-zinc-500">10,000 TPS · 400ms blocks</span>
            </div>
            <div className="flex flex-col gap-0.5 break-all">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                aprMON (aPriori)
              </span>
              <span className="font-mono text-[10px] text-zinc-200">
                0x0c65...E0852
              </span>
              <span className="text-[10px] text-zinc-500">
                Reward-bearing LST
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Vault status
              </span>
              <span className="font-medium text-emerald-300">
                {VAULT_ADDRESS !== "0x" ? "Deployed" : "Not deployed yet"}
              </span>
            </div>
          </div>
        </section>

        {/* Vault dashboard (connected only) */}
        {isConnected ? (
          <>
            <VaultDashboard />
            <SubscriptionSection />
          </>
        ) : (
          <section className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 px-8 py-12 text-center">
            <div className="pulse-glow rounded-full bg-violet-500/20 p-4">
              <Shield className="h-8 w-8 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold">Connect your wallet</h2>
            <p className="max-w-md text-sm text-zinc-400">
              Connect with any EVM wallet to view your vault, deposit aprMON,
              and manage your yield-funded subscriptions.
            </p>
            <ConnectButton />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-[11px] text-zinc-600">
          <span>Ectoplasma · Monad</span>
          <div className="flex gap-4">
            <a
              href="https://monadscan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition"
            >
              Explorer
            </a>
            <a
              href="https://docs.monad.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition"
            >
              Monad Docs
            </a>
            <a
              href="https://apriori-docs.gitbook.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition"
            >
              aPriori Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
