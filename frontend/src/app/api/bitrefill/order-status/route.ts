import { NextResponse } from "next/server";
import { callBitrefill } from "../client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json(
      { error: "orderId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const result = await callBitrefill(`/order/${encodeURIComponent(orderId)}`, {
      method: "GET",
    });

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      orderId,
      order: result.json ?? result.text,
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
        error: "Bitrefill /order-status call failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
