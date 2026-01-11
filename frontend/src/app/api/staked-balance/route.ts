import { NextResponse } from "next/server";

const RPC_NODE_URL = process.env.CASPER_RPC_NODE_URL ?? "http://65.109.83.79:7777/rpc";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const publicKeyHex = searchParams.get("publicKey");

  if (!publicKeyHex) {
    return NextResponse.json(
      { error: "Missing publicKey query parameter" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      stakedBalance: null,
      note:
        "Reading the on-chain staking balance for this contract requires a Casper node with speculative_exec enabled or an indexer. The public hackathon node only exposes standard RPCs at ".concat(
          RPC_NODE_URL
        ),
    },
    { status: 200 }
  );
}
