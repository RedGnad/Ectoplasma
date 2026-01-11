import { NextResponse } from "next/server";

const SUPPORTED_PROVIDERS = ["netflix", "spotify", "casper_dapp"] as const;

type ProviderId = (typeof SUPPORTED_PROVIDERS)[number];

interface ExternalSubscriptionRequest {
  provider: ProviderId;
  fiatAmount: number;
  currency: string;
  userPublicKeyHex: string;
  description?: string;
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
    provider,
    fiatAmount,
    currency,
    userPublicKeyHex,
    description,
  } = body as Partial<ExternalSubscriptionRequest>;

  if (!provider || !SUPPORTED_PROVIDERS.includes(provider as ProviderId)) {
    return NextResponse.json(
      { error: "Invalid or missing provider", supportedProviders: SUPPORTED_PROVIDERS },
      { status: 400 }
    );
  }

  if (typeof fiatAmount !== "number" || !Number.isFinite(fiatAmount) || fiatAmount <= 0) {
    return NextResponse.json(
      { error: "fiatAmount must be a positive number" },
      { status: 400 }
    );
  }

  if (!currency || typeof currency !== "string") {
    return NextResponse.json(
      { error: "currency is required" },
      { status: 400 }
    );
  }

  if (!userPublicKeyHex || typeof userPublicKeyHex !== "string") {
    return NextResponse.json(
      { error: "userPublicKeyHex is required" },
      { status: 400 }
    );
  }

  const externalEndpoint = process.env.EXTERNAL_PAYMENTS_ENDPOINT ?? null;

  const simulatedPayload: ExternalSubscriptionRequest = {
    provider: provider as ProviderId,
    fiatAmount,
    currency,
    userPublicKeyHex,
    description: description ?? undefined,
  };

  return NextResponse.json({
    status: "simulated",
    provider,
    simulatedPayload,
    configuredExternalEndpoint: externalEndpoint,
    note:
      "In production, this route would call an external payments API (for example a gift-card or crypto-card provider) to settle a Web2 subscription like Netflix or Spotify using funds scheduled by the Ectoplasma vault.",
  });
}
