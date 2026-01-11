import { NextResponse } from "next/server";

const CHAINGPT_NEWS_ENDPOINT = "https://api.chaingpt.org/news";

export async function GET(request: Request) {
  const apiKey = process.env.CHAINGPT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "CHAINGPT_API_KEY is not configured on the server. Set it in your environment variables before calling this endpoint.",
      },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("searchQuery") ?? "";
  const limitParam = url.searchParams.get("limit");

  let limit = 5;
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 20) {
      limit = parsed;
    }
  }

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  const trimmedQuery = searchQuery.trim();
  if (trimmedQuery.length > 0) {
    params.set("searchQuery", trimmedQuery);
  }

  const apiUrl = `${CHAINGPT_NEWS_ENDPOINT}?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `ChainGPT API error ${response.status}`,
          body: text.slice(0, 2000),
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(
      {
        source: "chaingpt",
        endpoint: "/news",
        params: Object.fromEntries(params.entries()),
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to call ChainGPT API",
      },
      { status: 502 }
    );
  }
}
