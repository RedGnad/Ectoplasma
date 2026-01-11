import { NextResponse } from "next/server";
import { callBitrefill } from "../client";

export async function GET() {
  try {
    const result = await callBitrefill("/test", { method: "GET" });

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      configured: true,
      upstreamRaw: result.text,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Bitrefill API is not configured")
    ) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          note:
            "Bitrefill API is not configured. Set BITREFILL_API_KEY and BITREFILL_API_SECRET to enable this endpoint.",
        },
        { status: 501 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: "Bitrefill /test call failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
