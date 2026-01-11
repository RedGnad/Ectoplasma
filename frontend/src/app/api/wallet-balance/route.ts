import { NextResponse } from "next/server";

const RPC_NODE_URL =
  process.env.CASPER_RPC_URL ?? "http://65.109.83.79:7777/rpc";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const publicKey = url.searchParams.get("publicKey");

  if (!publicKey) {
    return NextResponse.json(
      { error: "Missing publicKey query parameter" },
      { status: 400 }
    );
  }

  const body = {
    id: 1,
    jsonrpc: "2.0",
    method: "query_balance",
    params: {
      purse_identifier: {
        main_purse_under_public_key: publicKey,
      },
    },
  };

  try {
    const response = await fetch(RPC_NODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `RPC HTTP error ${response.status}` },
        { status: 502 }
      );
    }

    const json = await response.json();

    if (json.error) {
      return NextResponse.json(
        { error: json.error.message || "RPC error" },
        { status: 502 }
      );
    }

    const balanceField = json.result?.balance;
    let motesStr: string | null = null;

    if (typeof balanceField === "string") {
      motesStr = balanceField;
    } else if (balanceField && typeof balanceField === "object") {
      if (typeof balanceField.value === "string") {
        motesStr = balanceField.value;
      } else if (typeof balanceField.parsed === "string") {
        motesStr = balanceField.parsed;
      }
    }

    if (!motesStr) {
      return NextResponse.json(
        { error: "Unexpected balance format in RPC response" },
        { status: 502 }
      );
    }

    const MOTES_PER_CSPR = 1_000_000_000;
    const balanceCSPR = parseFloat(motesStr) / MOTES_PER_CSPR;

    if (!Number.isFinite(balanceCSPR)) {
      return NextResponse.json(
        { error: "Failed to parse balance from motes" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      balanceCSPR,
      motes: motesStr,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to query wallet balance",
      },
      { status: 502 }
    );
  }
}
