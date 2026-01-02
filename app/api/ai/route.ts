
import { NextResponse } from "next/server";

const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.pollinations_key;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Pollinations API key is not configured on the server." },
        { status: 500 },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { prompt?: string; system?: string; temperature?: number }
      | null;

    if (!body || !body.prompt) {
      return NextResponse.json(
        { error: "Missing prompt in request body." },
        { status: 400 },
      );
    }

    const { prompt, system, temperature } = body;

    const payload = {
      model: "openai",
      temperature: typeof temperature === "number" ? temperature : 0.7,
      messages: [
        ...(system
          ? [{ role: "system" as const, content: system }]
          : []),
        { role: "user" as const, content: prompt },
      ],
    };

    const response = await fetch(POLLINATIONS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Pollinations API error",
          status: response.status,
          body: text,
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as any;
    const content =
      data?.choices?.[0]?.message?.content ?? data?.response ?? "";

    return NextResponse.json({ content });
  } catch (error) {
    console.error("/api/ai error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}

