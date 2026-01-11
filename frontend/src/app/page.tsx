"use client";

import { useEffect, useState } from "react";
import {
  Args,
  CLValue,
  Deploy,
  DeployHeader,
  ExecutableDeployItem,
  PublicKey,
} from "casper-js-sdk";

const ECTOPLASMA_PACKAGE_HASH_HEX =
  "hash-bafd091015bcf3e4c09f52ddf1221fd6f1d8ced42c08ff1c927913a13166da5c";
const PROXY_CALLER_WASM_PATH = "/proxy_caller.wasm";
const PAYMENT_AMOUNT_MOTES = "5000000000";
const CHAIN_NAME = "casper-test";
const MOTES_PER_CSPR = 1_000_000_000;
const RPC_NODE_URL = "http://65.109.83.79:7777/rpc";

// Demo stake thresholds (CSPR)
const MIN_STAKE_SPOTIFY_CSPR = 2500;
const MIN_STAKE_NETFLIX_CSPR = 5000;

function hexToUint8Array(hex: string): Uint8Array {
  const normalized = hex.startsWith("hash-") ? hex.slice(5) : hex;
  const clean = normalized.trim().toLowerCase();
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Invalid hex string for contract package hash");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function csprToMotes(amount: string): string {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) {
    throw new Error("Invalid CSPR amount format");
  }

  const [intPart, fracRaw = ""] = trimmed.split(".");
  const fracPadded = (fracRaw + "000000000").slice(0, 9);
  const combined = (intPart + fracPadded).replace(/^0+/, "");

  return combined === "" ? "0" : combined;
}

export default function Home() {
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  const [sessionBalanceCSPR, setSessionBalanceCSPR] = useState(0);
  const [walletBalanceCSPR, setWalletBalanceCSPR] = useState<number | null>(
    null
  );
  const [isFetchingWalletBalance, setIsFetchingWalletBalance] = useState(false);
  const [walletBalanceError, setWalletBalanceError] = useState<string | null>(
    null
  );
  const [stakedBalanceCSPR, setStakedBalanceCSPR] = useState<number | null>(
    null
  );
  const [isFetchingStakedBalance, setIsFetchingStakedBalance] = useState(false);
  const [stakedBalanceError, setStakedBalanceError] = useState<string | null>(
    null
  );
  const [stakedBalanceNote, setStakedBalanceNote] = useState<string | null>(
    null
  );
  const [planName, setPlanName] = useState("");
  const [planPriceCSPR, setPlanPriceCSPR] = useState("");
  const [planDurationDays, setPlanDurationDays] = useState("");
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [subscribeStatus, setSubscribeStatus] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [isBitrefillBusy, setIsBitrefillBusy] = useState(false);
  const [bitrefillPingOk, setBitrefillPingOk] = useState<boolean | null>(null);
  const [bitrefillInventoryOk, setBitrefillInventoryOk] = useState<
    boolean | null
  >(null);
  const [bitrefillLastOrderId, setBitrefillLastOrderId] = useState<
    string | null
  >(null);
  const [demoSubscriptions, setDemoSubscriptions] = useState<number[]>([]);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);
  const [aiNewsError, setAiNewsError] = useState<string | null>(null);
  const [aiNewsRaw, setAiNewsRaw] = useState<string | null>(null);
  const [aiNewsItems, setAiNewsItems] = useState<
    { title: string; url?: string; createdAt?: string }[]
  >([]);

  const handleConnectClick = () => {
    if (typeof window !== "undefined" && (window as any).csprclick) {
      (window as any).csprclick.signIn();
    }
  };

  const handleAiNewsClick = async () => {
    setAiNewsLoading(true);
    setAiNewsError(null);
    setAiNewsRaw(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "5");

      const response = await fetch(`/api/chaingpt-news?${params.toString()}`);

      if (!response.ok) {
        const text = await response.text();
        let friendly = `ChainGPT backend error (${response.status})`;

        try {
          const parsed: any = JSON.parse(text);
          let detail = "";

          if (parsed && typeof parsed.error === "string") {
            detail = parsed.error;
          }

          if (parsed && typeof parsed.body === "string") {
            try {
              const inner: any = JSON.parse(parsed.body);
              if (inner && typeof inner.message === "string") {
                detail = inner.message;
              }
            } catch {
              if (!detail) {
                detail = parsed.body;
              }
            }
          }

          if (detail) {
            if (/insufficient credits/i.test(detail)) {
              friendly =
                "ChainGPT: insufficient credits on this API key – integration is wired but live news cannot be fetched in this demo.";
            } else {
              friendly = `ChainGPT API error: ${detail}`;
            }
          }
        } catch {
          // keep default friendly message
        }

        setAiNewsError(friendly);
        return;
      }

      const json = await response.json();
      console.log("chaingpt:/api/chaingpt-news response", json);
      const core = json?.data;

      let items: any[] = [];
      if (Array.isArray(core)) {
        items = core;
      } else if (core && Array.isArray((core as any).data)) {
        // Shape: { statusCode, message, data: [...] }
        items = (core as any).data;
      } else if (core && Array.isArray((core as any).items)) {
        items = (core as any).items;
      } else if (core && Array.isArray((core as any).results)) {
        items = (core as any).results;
      } else if (Array.isArray(json)) {
        items = json;
      } else if (json && Array.isArray((json as any).items)) {
        items = (json as any).items;
      }

      const mapped = items.slice(0, 3).map((item) => ({
        title: String(item?.title ?? "Untitled"),
        url: typeof item?.url === "string" ? item.url : undefined,
        createdAt:
          typeof item?.createdAt === "string" ? item.createdAt : undefined,
      }));

      if (!mapped.length) {
        setAiNewsError(
          "ChainGPT did not return any news for this query. Integration is live; you can retry later or broaden the query."
        );
        setAiNewsItems([]);
        setAiNewsRaw(null);
        return;
      }

      setAiNewsItems(mapped);
      setAiNewsRaw(JSON.stringify(mapped, null, 2));
    } catch (error) {
      setAiNewsError(
        error instanceof Error
          ? error.message
          : "Unexpected error while calling ChainGPT API"
      );
    } finally {
      setAiNewsLoading(false);
    }
  };

  const handleCreatePlanClick = async () => {
    if (!walletReady || !connectedAccount) {
      return;
    }

    if (typeof window === "undefined" || !(window as any).csprclick) {
      return;
    }

    try {
      setIsCreatingPlan(true);
      setPlanStatus(null);
      setPlanError(null);

      const publicKey = PublicKey.fromHex(connectedAccount);

      const name = planName.trim();
      const priceStr = planPriceCSPR.trim();
      const durationStr = planDurationDays.trim();

      if (!name || !priceStr || !durationStr) {
        console.error("All plan fields are required");
        setPlanError("Missing fields");
        setIsCreatingPlan(false);
        return;
      }

      const priceNumeric = parseFloat(priceStr);
      if (!Number.isFinite(priceNumeric) || priceNumeric <= 0) {
        console.error("Plan price must be greater than 0");
        setPlanError("Price must be > 0");
        setIsCreatingPlan(false);
        return;
      }

      const durationDays = parseInt(durationStr, 10);
      if (!Number.isFinite(durationDays) || durationDays <= 0) {
        console.error("Plan duration (days) must be greater than 0");
        setPlanError("Duration must be > 0");
        setIsCreatingPlan(false);
        return;
      }

      let priceMotes: string;
      try {
        priceMotes = csprToMotes(priceStr);
      } catch (e) {
        console.error("Invalid plan price", e);
        setPlanError("Invalid price format");
        setIsCreatingPlan(false);
        return;
      }

      if (
        !ECTOPLASMA_PACKAGE_HASH_HEX ||
        ECTOPLASMA_PACKAGE_HASH_HEX.startsWith("REPLACE_WITH_PACKAGE_HASH_HEX")
      ) {
        console.error("ECTOPLASMA_PACKAGE_HASH_HEX is not configured");
        setPlanError("Contract not configured");
        setIsCreatingPlan(false);
        return;
      }

      const wasmResponse = await fetch(PROXY_CALLER_WASM_PATH);
      if (!wasmResponse.ok) {
        console.error("Failed to load proxy_caller.wasm");
        setPlanError("Failed to load proxy wasm");
        setIsCreatingPlan(false);
        return;
      }

      const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());

      const contractPackageHashBytes = hexToUint8Array(
        ECTOPLASMA_PACKAGE_HASH_HEX
      );

      const periodSecs = durationDays * 24 * 60 * 60;

      const innerArgs = Args.fromMap({
        price_per_period: CLValue.newCLUInt512(priceMotes),
        period_secs: CLValue.newCLUint64(periodSecs.toString()),
        name: CLValue.newCLString(name),
        description: CLValue.newCLString("Hackathon demo plan"),
      });
      const argsBytes = innerArgs.toBytes();

      const proxyArgs = Args.fromMap({
        contract_package_hash: CLValue.newCLByteArray(contractPackageHashBytes),
        entry_point: CLValue.newCLString("create_plan"),
        args: CLValue.newCLByteArray(argsBytes),
        attached_value: CLValue.newCLUInt512("0"),
        amount: CLValue.newCLUInt512("0"),
      });

      const session = ExecutableDeployItem.newModuleBytes(wasmBytes, proxyArgs);

      const payment =
        ExecutableDeployItem.standardPayment(PAYMENT_AMOUNT_MOTES);

      const header = new DeployHeader();
      header.account = publicKey;
      header.chainName = CHAIN_NAME;

      const deploy = Deploy.makeDeploy(header, payment, session);

      const deployJson = Deploy.toJSON(deploy);

      const onStatusUpdate = (status: string, data: unknown) => {
        console.log("csprclick:create_plan_status", status, data);
      };

      const result = await (window as any).csprclick.send(
        deployJson,
        connectedAccount,
        onStatusUpdate
      );

      console.log("csprclick:create_plan_result", result);
      setPlanStatus("Plan deploy sent");
    } catch (error) {
      console.error("Create plan failed", error);
      setPlanError("Create plan failed");
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleSwitchAccountClick = () => {
    if (typeof window !== "undefined" && (window as any).csprclick) {
      (window as any).csprclick.switchAccount();
    }
  };

  const handleDisconnectClick = () => {
    if (typeof window !== "undefined" && (window as any).csprclick) {
      (window as any).csprclick.signOut();
    }
  };

  const handleDepositClick = async (amountCSPR: number) => {
    if (!walletReady || !connectedAccount) {
      return;
    }

    if (typeof window === "undefined" || !(window as any).csprclick) {
      return;
    }

    try {
      setIsDepositing(true);

      const publicKey = PublicKey.fromHex(connectedAccount);

      if (!Number.isFinite(amountCSPR) || amountCSPR <= 0) {
        console.error("Deposit amount must be greater than 0");
        setIsDepositing(false);
        return;
      }

      const amountStr = amountCSPR.toString();

      let depositAmountMotes: string;
      try {
        depositAmountMotes = csprToMotes(amountStr);
      } catch (e) {
        console.error("Invalid deposit amount", e);
        setIsDepositing(false);
        return;
      }

      if (depositAmountMotes === "0") {
        console.error("Deposit amount in motes is 0");
        setIsDepositing(false);
        return;
      }

      if (
        !ECTOPLASMA_PACKAGE_HASH_HEX ||
        ECTOPLASMA_PACKAGE_HASH_HEX.startsWith("REPLACE_WITH_PACKAGE_HASH_HEX")
      ) {
        console.error("ECTOPLASMA_PACKAGE_HASH_HEX is not configured");
        setIsDepositing(false);
        return;
      }

      const wasmResponse = await fetch(PROXY_CALLER_WASM_PATH);
      if (!wasmResponse.ok) {
        console.error("Failed to load proxy_caller.wasm");
        setIsDepositing(false);
        return;
      }

      const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());

      const contractPackageHashBytes = hexToUint8Array(
        ECTOPLASMA_PACKAGE_HASH_HEX
      );

      const emptyArgs = Args.fromMap({});
      const argsBytes = emptyArgs.toBytes();

      const proxyArgs = Args.fromMap({
        contract_package_hash: CLValue.newCLByteArray(contractPackageHashBytes),
        entry_point: CLValue.newCLString("deposit"),
        args: CLValue.newCLByteArray(argsBytes),
        attached_value: CLValue.newCLUInt512(depositAmountMotes),
        amount: CLValue.newCLUInt512("0"),
      });

      const session = ExecutableDeployItem.newModuleBytes(wasmBytes, proxyArgs);

      const payment =
        ExecutableDeployItem.standardPayment(PAYMENT_AMOUNT_MOTES);

      const header = new DeployHeader();
      header.account = publicKey;
      header.chainName = CHAIN_NAME;

      const deploy = Deploy.makeDeploy(header, payment, session);

      const deployJson = Deploy.toJSON(deploy);

      const onStatusUpdate = (status: string, data: unknown) => {
        console.log("csprclick:deposit_status", status, data);
        if (status === "processed") {
          setSessionBalanceCSPR((prev) => prev + amountCSPR);
        }
      };

      const result = await (window as any).csprclick.send(
        deployJson,
        connectedAccount,
        onStatusUpdate
      );

      console.log("csprclick:deposit_result", result);
    } catch (error) {
      console.error("Deposit failed", error);
    } finally {
      setIsDepositing(false);
    }
  };

  const fetchWalletBalance = async () => {
    if (!walletReady || !connectedAccount) {
      return;
    }

    try {
      setIsFetchingWalletBalance(true);
      setWalletBalanceError(null);

      const response = await fetch(
        `/api/wallet-balance?publicKey=${encodeURIComponent(connectedAccount)}`
      );

      const json = await response.json();

      if (!response.ok) {
        const message =
          json && typeof json.error === "string"
            ? json.error
            : `Backend HTTP error ${response.status}`;
        throw new Error(message);
      }

      if (
        !json ||
        (typeof json.balanceCSPR !== "number" &&
          typeof json.balanceCSPR !== "string")
      ) {
        throw new Error("Unexpected response from wallet-balance API");
      }

      const numericBalance =
        typeof json.balanceCSPR === "number"
          ? json.balanceCSPR
          : parseFloat(json.balanceCSPR);

      if (Number.isNaN(numericBalance)) {
        throw new Error("Failed to parse balance from API");
      }

      setWalletBalanceCSPR(numericBalance);
    } catch (error: unknown) {
      console.error("Failed to fetch wallet balance", error);
      if (error instanceof Error) {
        setWalletBalanceError(error.message);
      } else {
        setWalletBalanceError("Failed to fetch wallet balance");
      }
    } finally {
      setIsFetchingWalletBalance(false);
    }
  };

  const fetchStakedBalance = async () => {
    if (!walletReady || !connectedAccount) {
      return;
    }

    try {
      setIsFetchingStakedBalance(true);
      setStakedBalanceError(null);
      setStakedBalanceNote(null);

      const response = await fetch(
        `/api/staked-balance?publicKey=${encodeURIComponent(connectedAccount)}`
      );

      if (!response.ok) {
        throw new Error(`Backend HTTP error ${response.status}`);
      }

      const json = await response.json();

      if (
        json &&
        json.stakedBalance !== undefined &&
        json.stakedBalance !== null
      ) {
        let numeric: number | null = null;
        if (typeof json.stakedBalance === "number") {
          numeric = json.stakedBalance;
        } else if (typeof json.stakedBalance === "string") {
          const parsed = parseFloat(json.stakedBalance);
          if (Number.isFinite(parsed)) {
            numeric = parsed;
          }
        }
        if (numeric !== null && !Number.isNaN(numeric)) {
          setStakedBalanceCSPR(numeric);
        }
      }

      if (json && typeof json.note === "string") {
        setStakedBalanceNote(json.note);
      }
    } catch (error: unknown) {
      console.error("Failed to fetch staked balance", error);
      if (error instanceof Error) {
        setStakedBalanceError(error.message);
      } else {
        setStakedBalanceError("Failed to fetch staked balance");
      }
    } finally {
      setIsFetchingStakedBalance(false);
    }
  };

  const handleBitrefillPing = async () => {
    try {
      setIsBitrefillBusy(true);
      setBitrefillPingOk(null);

      const response = await fetch("/api/bitrefill/test");
      const json = await response.json();

      if (!response.ok || !json.ok || json.configured === false) {
        setBitrefillPingOk(false);
        return;
      }

      setBitrefillPingOk(true);
    } catch {
      setBitrefillPingOk(false);
    } finally {
      setIsBitrefillBusy(false);
    }
  };

  const handleBitrefillPricing = async () => {
    try {
      setIsBitrefillBusy(true);
      setBitrefillInventoryOk(null);

      const response = await fetch(
        "/api/bitrefill/inventory?slug=lightning-recharge"
      );
      const json = await response.json();

      if (!response.ok || !json.ok || json.configured === false) {
        setBitrefillInventoryOk(false);
        return;
      }

      setBitrefillInventoryOk(true);
    } catch {
      setBitrefillInventoryOk(false);
    } finally {
      setIsBitrefillBusy(false);
    }
  };

  const handleBitrefillDemoOrder = async () => {
    try {
      setIsBitrefillBusy(true);
      setBitrefillLastOrderId(null);

      const response = await fetch("/api/bitrefill/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operatorSlug: "lightning-channel",
          valuePackage: "2000000",
          email: "hackathon-demo@example.com",
          paymentMethod: "bitcoin",
          userRef: "ectoplasma-demo",
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok || json.configured === false) {
        return;
      }

      const order = json.order as { id?: string } | undefined;
      if (order && typeof order.id === "string") {
        setBitrefillLastOrderId(order.id);
      }
    } catch {
      // keep silent in UI; this is a demo helper
    } finally {
      setIsBitrefillBusy(false);
    }
  };

  const handleSubscribeClick = async (planIdNum: number) => {
    if (!walletReady || !connectedAccount) {
      return;
    }

    if (typeof window === "undefined" || !(window as any).csprclick) {
      return;
    }

    try {
      setIsSubscribing(true);
      setSubscribeStatus(null);
      setSubscribeError(null);

      const publicKey = PublicKey.fromHex(connectedAccount);
      if (!Number.isInteger(planIdNum) || planIdNum < 0) {
        console.error("Plan ID must be a non-negative integer");
        setSubscribeError("Invalid plan ID");
        setIsSubscribing(false);
        return;
      }

      if (
        !ECTOPLASMA_PACKAGE_HASH_HEX ||
        ECTOPLASMA_PACKAGE_HASH_HEX.startsWith("REPLACE_WITH_PACKAGE_HASH_HEX")
      ) {
        console.error("ECTOPLASMA_PACKAGE_HASH_HEX is not configured");
        setSubscribeError("Contract not configured");
        setIsSubscribing(false);
        return;
      }

      const wasmResponse = await fetch(PROXY_CALLER_WASM_PATH);
      if (!wasmResponse.ok) {
        console.error("Failed to load proxy_caller.wasm");
        setSubscribeError("Failed to load proxy wasm");
        setIsSubscribing(false);
        return;
      }

      const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());

      const contractPackageHashBytes = hexToUint8Array(
        ECTOPLASMA_PACKAGE_HASH_HEX
      );

      const innerArgs = Args.fromMap({
        plan_id: CLValue.newCLUint64(planIdNum.toString()),
      });
      const argsBytes = innerArgs.toBytes();

      const proxyArgs = Args.fromMap({
        contract_package_hash: CLValue.newCLByteArray(contractPackageHashBytes),
        entry_point: CLValue.newCLString("subscribe"),
        args: CLValue.newCLByteArray(argsBytes),
        attached_value: CLValue.newCLUInt512("0"),
        amount: CLValue.newCLUInt512("0"),
      });

      const session = ExecutableDeployItem.newModuleBytes(wasmBytes, proxyArgs);

      const payment =
        ExecutableDeployItem.standardPayment(PAYMENT_AMOUNT_MOTES);

      const header = new DeployHeader();
      header.account = publicKey;
      header.chainName = CHAIN_NAME;

      const deploy = Deploy.makeDeploy(header, payment, session);

      const deployJson = Deploy.toJSON(deploy);

      let processed = false;
      const onStatusUpdate = (status: string, data: unknown) => {
        console.log("csprclick:subscribe_status", status, data);
        if (status === "processed") {
          processed = true;
          setSubscribeStatus("Subscription processed on-chain");
          setDemoSubscriptions((prev) => {
            if (!Number.isInteger(planIdNum) || planIdNum < 0) {
              return prev;
            }
            if (prev.includes(planIdNum)) {
              return prev;
            }
            return [...prev, planIdNum];
          });
        }
      };

      const result = await (window as any).csprclick.send(
        deployJson,
        connectedAccount,
        onStatusUpdate
      );

      console.log("csprclick:subscribe_result", result);
    } catch (error) {
      console.error("Subscribe failed", error);
      setSubscribeError("Subscribe failed");
    } finally {
      setIsSubscribing(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cleanupSdkListeners: (() => void) | null = null;
    let intervalId: number | null = null;

    const extractPublicKeyFromAccount = (input: any): string | null => {
      if (!input) {
        return null;
      }
      const account = input.account ?? input;
      const pk =
        account.public_key ||
        account.publicKeyHex ||
        account.publicKey ||
        (account.account &&
          (account.account.public_key || account.account.publicKeyHex));
      if (typeof pk === "string" && pk.length > 0) {
        return pk;
      }
      return null;
    };

    const initSdk = () => {
      const sdk = (window as any).csprclick;
      if (!sdk || typeof sdk.on !== "function") {
        return false;
      }

      console.log("csprclick:init sdk", sdk);
      setWalletReady(true);

      const handleLoaded = async () => {
        console.log("csprclick:on loaded");
        setWalletReady(true);
        if (typeof sdk.getActiveAccountAsync === "function") {
          try {
            const account = await sdk.getActiveAccountAsync();
            const pk = extractPublicKeyFromAccount(account);
            if (pk) {
              setConnectedAccount(pk);
            }
          } catch (error) {
            console.error("csprclick: failed to read active account", error);
          }
        }
      };

      const handleSignedIn = (evt: any) => {
        console.log("csprclick:on signed_in", evt);
        const pk = extractPublicKeyFromAccount(evt);
        if (pk) {
          setConnectedAccount(pk);
        }
      };

      const handleSwitchedAccount = (evt: any) => {
        console.log("csprclick:on switched_account", evt);
        const pk = extractPublicKeyFromAccount(evt);
        if (pk) {
          setConnectedAccount(pk);
        }
      };

      const handleSignedOut = () => {
        console.log("csprclick:on signed_out");
        setConnectedAccount(null);
      };

      const handleDisconnected = () => {
        console.log("csprclick:on disconnected");
        setConnectedAccount(null);
      };

      sdk.on("csprclick:loaded", handleLoaded);
      sdk.on("csprclick:signed_in", handleSignedIn);
      sdk.on("csprclick:switched_account", handleSwitchedAccount);
      sdk.on("csprclick:signed_out", handleSignedOut);
      sdk.on("csprclick:disconnected", handleDisconnected);

      if (typeof sdk.getActiveAccountAsync === "function") {
        sdk
          .getActiveAccountAsync()
          .then((account: any) => {
            const pk = extractPublicKeyFromAccount(account);
            if (pk) {
              setConnectedAccount(pk);
            }
          })
          .catch((error: unknown) => {
            console.error("csprclick: failed to read active account", error);
          });
      }

      cleanupSdkListeners = () => {
        if (typeof sdk.off === "function") {
          sdk.off("csprclick:loaded", handleLoaded);
          sdk.off("csprclick:signed_in", handleSignedIn);
          sdk.off("csprclick:switched_account", handleSwitchedAccount);
          sdk.off("csprclick:signed_out", handleSignedOut);
          sdk.off("csprclick:disconnected", handleDisconnected);
        }
      };

      return true;
    };

    if (!initSdk()) {
      intervalId = window.setInterval(() => {
        if (initSdk()) {
          if (intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
        }
      }, 250);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (cleanupSdkListeners) {
        cleanupSdkListeners();
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-zinc-50 font-sans">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.35)_0,transparent_55%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.28)_0,transparent_55%)]"
        aria-hidden="true"
      />
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <img
              src="/logos/ectoplasma-logo.png.png"
              alt="Ectoplasma logo"
              className="h-14 w-14 object-contain"
            />
            <div className="flex flex-col">
              <span className="text-base md:text-lg font-semibold tracking-tight">
                Ectoplasma
              </span>
              <span className="text-xs md:text-sm text-zinc-400">
                Stake-to-Subscribe on Casper
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 md:py-14">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-72 w-[110%] -translate-x-1/2 bg-[radial-gradient(circle,rgba(139,92,246,0.45)_0,transparent_60%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -top-10 -right-32 -z-10 h-64 w-64 rounded-full border border-violet-400/40 bg-linear-to-tr from-violet-500/20 via-transparent to-emerald-400/30 opacity-80 blur-sm"
          aria-hidden="true"
        />
        <section className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            On-chain subscription vault for Casper.
          </h1>
          <p className="text-sm md:text-base text-zinc-400">
            Deposit CSPR into a dedicated vault contract, let merchants publish
            on-chain subscription plans, and pay recurring fees from your
            contract-managed balance. Designed to integrate staking yield in
            production.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em]">
            <span className="rounded-full bg-violet-500/10 px-3 py-1 text-violet-300 ring-1 ring-violet-500/40">
              On-chain vault
            </span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300 ring-1 ring-emerald-500/40">
              Casper testnet
            </span>
            <span className="rounded-full bg-zinc-800/80 px-3 py-1 text-zinc-300 ring-1 ring-zinc-700">
              Hackathon prototype
            </span>
          </div>
        </section>

        <div
          className="absolute right-6 top-24 hidden flex-col items-end gap-3 md:flex"
          aria-hidden="true"
        >
          <img
            src="/logos/netflix.png"
            alt="Netflix example subscription"
            className="float-slow h-14 w-auto rounded-full bg-zinc-950/80 px-3 py-1 shadow-lg shadow-violet-500/40 ring-1 ring-zinc-700/80"
          />
          <img
            src="/logos/spotify.png"
            alt="Spotify example subscription"
            className="float-slow-delay h-14 w-auto rounded-full bg-zinc-950/80 px-3 py-1 shadow-lg shadow-emerald-500/40 ring-1 ring-zinc-700/80"
          />
          <img
            src="/logos/bitrefill.png"
            alt="Bitrefill bridge example"
            className="float-slow h-14 w-auto rounded-full bg-zinc-950/80 px-3 py-1 shadow-lg shadow-sky-500/40 ring-1 ring-zinc-700/80"
          />
          <img
            src="/logos/casper-app.png"
            alt="Casper dApps example subscription"
            className="float-slow h-14 w-auto rounded-full bg-violet-500/20 px-3 py-1 shadow-lg shadow-violet-500/40 ring-1 ring-violet-500/60"
          />
        </div>

        <section className="max-w-3xl rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-[11px] text-zinc-300 md:text-xs">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Network
              </span>
              <span className="font-medium text-zinc-100">Casper testnet</span>
              <span className="text-[10px] text-zinc-500">
                RPC: 65.109.83.79:7777
              </span>
            </div>
            <div className="flex flex-col gap-0.5 break-all">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Vault contract package
              </span>
              <span className="font-mono text-[10px] text-zinc-200">
                hash-bafd091015bcf3e4c09f52ddf1221fd6f1d8ced42c08ff1c927913a13166da5c
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                Prototype status
              </span>
              <span className="font-medium text-emerald-300">
                Live on-chain, wallet-integrated
              </span>
              <span className="text-[10px] text-zinc-500">
                Deposits, plans, subscriptions & on-chain wallet balance
              </span>
            </div>
          </div>
        </section>

        <section className="max-w-3xl space-y-3 text-xs md:text-sm text-zinc-400">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
            How it works
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                1 · Connect
              </span>
              <p className="mt-1 text-[11px] md:text-xs">
                Link your Casper wallet with CSPR.click on the testnet.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                2 · Deposit
              </span>
              <p className="mt-1 text-[11px] md:text-xs">
                Deposit CSPR into the Ectoplasma vault contract; it tracks your
                balance on-chain.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                3 · Subscribe
              </span>
              <p className="mt-1 text-[11px] md:text-xs">
                Merchants publish plans; the contract pays recurring fees from
                your vault.
              </p>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500">
            Under the hood, your vault balance lives in an on-chain mapping;
            wallet balance is read via JSON-RPC, and a backend endpoint is ready
            to query a dedicated node or indexer for the staked balance in
            production.
          </p>
          <p className="text-[10px] text-zinc-500">
            * Brand names like Netflix and Spotify are illustrative examples of
            subscriptions only. Web2 gift cards are bridged via Bitrefill (demo,
            no live orders yet).
          </p>
        </section>

        <section className="relative grid gap-6 md:grid-cols-2">
          <div
            className="pointer-events-none absolute inset-y-4 left-1/2 hidden w-px -translate-x-1/2 bg-linear-to-b from-transparent via-violet-500/40 to-transparent md:block"
            aria-hidden="true"
          />
          {/* User block */}
          <div className="flex flex-col gap-4 rounded-2xl border border-violet-500/25 bg-zinc-900/70 p-5 shadow-[0_0_40px_rgba(129,140,248,0.28)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">User</h2>
                <p className="mt-1 text-xs text-zinc-400">
                  See your CSPR balance dedicated to subscriptions and your
                  active recurring payments.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/40">
                {connectedAccount
                  ? `Connected: ${connectedAccount.slice(
                      0,
                      6
                    )}…${connectedAccount.slice(-4)}`
                  : "No wallet connected"}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {!connectedAccount && (
                <button
                  type="button"
                  onClick={handleConnectClick}
                  className="rounded-full bg-violet-500 px-3 py-1.5 text-[11px] font-medium text-zinc-50 hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Connect wallet
                </button>
              )}
              {connectedAccount && (
                <>
                  <button
                    type="button"
                    onClick={handleSwitchAccountClick}
                    className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-zinc-500 hover:text-zinc-50"
                  >
                    Switch account
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectClick}
                    className="rounded-full border border-red-500/60 px-3 py-1.5 text-[11px] font-medium text-red-200 hover:border-red-400 hover:text-red-100"
                  >
                    Disconnect
                  </button>
                </>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Subscription vault balance (demo)
                  </span>
                  <span className="text-sm font-semibold">
                    {sessionBalanceCSPR.toFixed(2)} CSPR
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleDepositClick(1)}
                      disabled={
                        !connectedAccount || !walletReady || isDepositing
                      }
                      className="rounded-full bg-zinc-700 px-3 py-1.5 text-[11px] font-medium text-zinc-50 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDepositing ? "Depositing..." : "Test 1 CSPR"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDepositClick(2500)}
                      disabled={
                        !connectedAccount || !walletReady || isDepositing
                      }
                      className="rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-zinc-50 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDepositing ? "Depositing..." : "Stake 2 500 CSPR"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDepositClick(5000)}
                      disabled={
                        !connectedAccount || !walletReady || isDepositing
                      }
                      className="rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-zinc-50 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDepositing ? "Depositing..." : "Stake 5 000 CSPR"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDepositClick(10000)}
                      disabled={
                        !connectedAccount || !walletReady || isDepositing
                      }
                      className="rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-zinc-50 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDepositing ? "Depositing..." : "Stake 10 000 CSPR"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDepositClick(310000)}
                      disabled={
                        !connectedAccount || !walletReady || isDepositing
                      }
                      className="rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-medium text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDepositing
                        ? "Depositing..."
                        : "Spotify Gold (310 000)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDepositClick(465000)}
                      disabled={
                        !connectedAccount || !walletReady || isDepositing
                      }
                      className="rounded-full bg-amber-600 px-3 py-1.5 text-[11px] font-medium text-zinc-950 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDepositing
                        ? "Depositing..."
                        : "Netflix Gold (465 000)"}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Gold tiers target 100% coverage of Spotify / Netflix with
                    staking yield (demo assumptions).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Wallet on-chain balance
                  </span>
                  <span className="text-sm font-semibold">
                    {isFetchingWalletBalance
                      ? "Loading..."
                      : walletBalanceCSPR !== null
                      ? `${walletBalanceCSPR.toFixed(2)} CSPR`
                      : "--"}
                  </span>
                  {walletBalanceError && (
                    <span className="mt-1 text-[11px] text-red-400">
                      {walletBalanceError}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchWalletBalance}
                  disabled={
                    !connectedAccount || !walletReady || isFetchingWalletBalance
                  }
                  className="rounded-full border border-violet-500/60 px-3 py-1.5 text-[11px] font-medium text-violet-200 hover:border-violet-400 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingWalletBalance ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="flex items-start justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Staked balance (contract / API)
                  </span>
                  <span className="text-sm font-semibold">
                    {isFetchingStakedBalance
                      ? "Loading..."
                      : stakedBalanceCSPR !== null
                      ? `${stakedBalanceCSPR.toFixed(2)} CSPR`
                      : "--"}
                  </span>
                  {stakedBalanceError && (
                    <span className="text-[11px] text-red-400">
                      {stakedBalanceError}
                    </span>
                  )}
                  {stakedBalanceNote && !stakedBalanceError && (
                    <span className="text-[11px] text-zinc-500">
                      {stakedBalanceNote}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchStakedBalance}
                  disabled={
                    !connectedAccount || !walletReady || isFetchingStakedBalance
                  }
                  className="ml-3 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-medium text-zinc-200 hover:border-violet-500/70 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetchingStakedBalance ? "Refreshing..." : "Check API"}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Subscribe to a plan
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleSubscribeClick(0)}
                      disabled={
                        !connectedAccount ||
                        !walletReady ||
                        isSubscribing ||
                        sessionBalanceCSPR <= 0
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-lime-400 px-4 py-1.5 text-[11px] font-semibold text-zinc-950 shadow-[0_0_22px_rgba(190,242,100,0.90)] ring-1 ring-lime-300/80 transition-all hover:bg-lime-300 hover:shadow-[0_0_30px_rgba(217,249,157,1)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubscribing ? "Subscribing..." : "Subscribe Netflix"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubscribeClick(1)}
                      disabled={
                        !connectedAccount ||
                        !walletReady ||
                        isSubscribing ||
                        sessionBalanceCSPR <= 0
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-lime-500 px-4 py-1.5 text-[11px] font-semibold text-zinc-950 shadow-[0_0_22px_rgba(132,204,22,0.95)] ring-1 ring-lime-400/80 transition-all hover:bg-lime-400 hover:shadow-[0_0_30px_rgba(190,242,100,1)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubscribing ? "Subscribing..." : "Subscribe Spotify"}
                    </button>
                  </div>
                  <div className="mt-1 h-4 text-[10px]">
                    {subscribeError && (
                      <span className="text-red-400">{subscribeError}</span>
                    )}
                    {!subscribeError && subscribeStatus && (
                      <span className="text-emerald-400">
                        {subscribeStatus}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    Min stake: 2 500 CSPR (Spotify), 5 000 CSPR (Netflix).
                  </p>
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                      AI news (ChainGPT)
                    </span>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      AI-curated crypto news around Casper, liquid staking, DeFi
                      and subscription payments.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAiNewsClick}
                    disabled={aiNewsLoading}
                    className="h-8 rounded-full border border-emerald-400/70 bg-emerald-400/10 px-3 text-[11px] font-medium text-emerald-200 hover:bg-emerald-400/20 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aiNewsLoading ? "Loading..." : "Fetch AI news"}
                  </button>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  {aiNewsError && <p className="text-red-400">{aiNewsError}</p>}
                  {!aiNewsError &&
                    aiNewsItems.length === 0 &&
                    !aiNewsLoading && (
                      <p className="text-zinc-500">
                        No AI news fetched yet in this session.
                      </p>
                    )}
                  {!aiNewsError && aiNewsItems.length > 0 && (
                    <ul className="space-y-1">
                      {aiNewsItems.map((item, idx) => (
                        <li
                          key={idx}
                          className="rounded-md border border-zinc-800/80 bg-zinc-950/70 px-2 py-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-zinc-100">
                              {item.title}
                            </span>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-[10px] text-emerald-300 hover:text-emerald-200"
                              >
                                Open
                              </a>
                            )}
                          </div>
                          {item.createdAt && (
                            <p className="mt-0.5 text-[10px] text-zinc-500">
                              {item.createdAt}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                    My subscriptions (demo)
                  </span>
                  {demoSubscriptions.length > 0 && (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                      Session only
                    </span>
                  )}
                </div>
                {demoSubscriptions.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">
                    No subscription yet in this session.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {demoSubscriptions.map((id) => {
                        const label =
                          id === 0
                            ? "Netflix"
                            : id === 1
                            ? "Spotify"
                            : `Plan #${id}`;
                        return (
                          <span
                            key={id}
                            className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-200"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                    <div className="mt-2 space-y-2">
                      {demoSubscriptions.map((id) => {
                        const service =
                          id === 0
                            ? "Netflix"
                            : id === 1
                            ? "Spotify"
                            : `Plan #${id}`;
                        const priceLabel =
                          id === 0
                            ? "15 €/mo (demo)"
                            : id === 1
                            ? "10 €/mo (demo)"
                            : "Custom plan (demo)";
                        return (
                          <div
                            key={`details-${id}`}
                            className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2 text-[10px] text-zinc-400"
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-medium text-zinc-200">
                                {service}
                              </span>
                              <span className="text-emerald-400">
                                Active (demo)
                              </span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                              <span className="text-zinc-500">
                                Subscription ID
                              </span>
                              <span className="font-mono text-zinc-300">
                                #{id}
                              </span>
                              <span className="text-zinc-500">Price</span>
                              <span>{priceLabel}</span>
                              <span className="text-zinc-500">Billing</span>
                              <span>Every 30 days from vault balance</span>
                              <span className="text-zinc-500">
                                Next billing (demo)
                              </span>
                              <span>In 30 days from subscription time</span>
                              <span className="text-zinc-500">Web2 bridge</span>
                              <span>
                                Gift card / API via Bitrefill or merchant
                                (concept)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Merchant block */}
          <div className="flex flex-col gap-4 rounded-2xl border border-sky-500/20 bg-zinc-900/70 p-5 shadow-[0_0_40px_rgba(56,189,248,0.22)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  Merchant
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Create on-chain subscription plans paid in CSPR from your
                  users’ staking yield.
                </p>
              </div>
              <span className="rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-300 ring-1 ring-sky-500/40">
                Contract ready
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Create a plan
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="h-8 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 text-[11px] outline-none placeholder:text-zinc-600 focus:border-violet-500"
                    placeholder="Plan name"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                  <input
                    className="h-8 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 text-[11px] outline-none placeholder:text-zinc-600 focus:border-violet-500"
                    placeholder="Price / period (CSPR)"
                    value={planPriceCSPR}
                    onChange={(e) => setPlanPriceCSPR(e.target.value)}
                  />
                  <input
                    className="col-span-2 h-8 rounded-md border border-zinc-800 bg-zinc-950/60 px-2 text-[11px] outline-none placeholder:text-zinc-600 focus:border-violet-500"
                    placeholder="Duration (days)"
                    value={planDurationDays}
                    onChange={(e) => setPlanDurationDays(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreatePlanClick}
                  disabled={!connectedAccount || !walletReady || isCreatingPlan}
                  className="mt-2 w-full rounded-md bg-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingPlan ? "Publishing..." : "Publish plan"}
                </button>
                <div className="mt-1 h-4 text-[10px]">
                  {planError && (
                    <span className="text-red-400">{planError}</span>
                  )}
                  {!planError && planStatus && (
                    <span className="text-emerald-400">{planStatus}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Existing plans
                </span>
                <p className="text-[11px] text-zinc-500">
                  The list of plans will come from Ectoplasma.wasm once the
                  Casper connection is wired.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
