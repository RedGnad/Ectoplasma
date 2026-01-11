import { NextResponse } from "next/server";
import { callBitrefill } from "../client";

const SUPPORTED_PAYMENT_METHODS = [
  "lightning",
  "lightning-ltc",
  "bitcoin",
  "ethereum",
  "litecoin",
  "dash",
  "dogecoin",
] as const;

type PaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number];

interface CreateOrderRequest {
  operatorSlug: string;
  valuePackage: string;
  email: string;
  paymentMethod?: PaymentMethod;
  refund_address?: string;
  webhook_url?: string;
  userRef?: string;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const {
    operatorSlug,
    valuePackage,
    email,
    paymentMethod,
    refund_address,
    webhook_url,
    userRef,
  } = body as Partial<CreateOrderRequest>;

  if (!operatorSlug || typeof operatorSlug !== "string") {
    return NextResponse.json(
      { error: "operatorSlug is required" },
      { status: 400 }
    );
  }

  if (!valuePackage || typeof valuePackage !== "string") {
    return NextResponse.json(
      { error: "valuePackage is required (string)" },
      { status: 400 }
    );
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "email is required" },
      { status: 400 }
    );
  }

  const method: PaymentMethod = paymentMethod &&
    SUPPORTED_PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)
    ? (paymentMethod as PaymentMethod)
    : "bitcoin";

  const payload: CreateOrderRequest = {
    operatorSlug,
    valuePackage,
    email,
    paymentMethod: method,
  };

  if (refund_address) {
    payload.refund_address = refund_address;
  }

  if (webhook_url) {
    payload.webhook_url = webhook_url;
  }

  if (userRef) {
    payload.userRef = userRef;
  }

  try {
    const result = await callBitrefill("/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      payload,
      order: result.json ?? result.text,
      note:
        "This creates an UNPAID Bitrefill order only (status 'unpaid'). No crypto payment is sent from this dApp.",
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
        error: "Bitrefill /order call failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
