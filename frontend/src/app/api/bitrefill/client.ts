const BITREFILL_BASE_URL = "https://api.bitrefill.com/v1";

function getAuthToken(): string | null {
  const apiKey = process.env.BITREFILL_API_KEY;
  const apiSecret = process.env.BITREFILL_API_SECRET;

  if (!apiKey || !apiSecret) {
    return null;
  }

  const raw = `${apiKey}:${apiSecret}`;
  return Buffer.from(raw).toString("base64");
}

export function isBitrefillConfigured(): boolean {
  return getAuthToken() !== null;
}

export async function callBitrefill(
  path: string,
  init: RequestInit & { method: string }
): Promise<{
  ok: boolean;
  status: number;
  json: unknown | null;
  text: string;
}> {
  const token = getAuthToken();

  if (!token) {
    throw new Error(
      "Bitrefill API is not configured. Set BITREFILL_API_KEY and BITREFILL_API_SECRET in the environment."
    );
  }

  const url = `${BITREFILL_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    Authorization: `Basic ${token}`,
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const text = await response.text();
  let json: unknown | null = null;

  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
    text,
  };
}
