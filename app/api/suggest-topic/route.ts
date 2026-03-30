import { NextRequest, NextResponse } from "next/server";
import { openRouterReferer } from "@/lib/openrouter-referer";

const DEEPSEEK_MODEL = "deepseek/deepseek-chat";
const SYSTEM_PROMPT =
  "Based on this document, suggest one specific debate topic in under 15 words. Return ONLY the topic string, nothing else.";

interface RequestBody {
  fileName?: string;
  fileText?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as RequestBody;
  const { fileName = "", fileText = "" } = body;

  const preview = fileText.slice(0, 1000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": openRouterReferer(),
        "X-Title": "Polymath X",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.7,
        max_tokens: 40,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `File: ${fileName}\n\n${preview}`,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const topic = (data.choices[0]?.message?.content ?? "").trim();
    return NextResponse.json({ topic });
  } catch (err) {
    console.error("[suggest-topic] error:", err);
    return NextResponse.json({ topic: "" }, { status: 500 });
  }
}
