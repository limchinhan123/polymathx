import { NextRequest, NextResponse } from "next/server";
import { openRouterReferer } from "@/lib/openrouter-referer";

// ── Types ────────────────────────────────────────────────────────────────────

interface ClarifyRequestBody {
  topic?: string;
}

interface ClarifyResponseBody {
  questions: [string, string, string];
}

const SAFE_DEFAULT: ClarifyResponseBody = {
  questions: [
    "What specific outcome are you trying to understand or decide?",
    "Are there constraints — time, resources, or context — that should shape the debate?",
    "What assumptions do you currently hold about this topic?",
  ],
};

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<ClarifyResponseBody>> {
  const body = (await req.json()) as ClarifyRequestBody;
  const { topic = "" } = body;

  const systemPrompt = `You generate clarifying questions to improve debate quality. Return ONLY valid JSON:
{
  "questions": ["string", "string", "string"]
}

Each question must be under 15 words.
Questions should uncover: the human's goal, relevant constraints, and current assumptions.
Do not ask obvious or generic questions.`;

  const userPrompt = `The debate topic is: ${topic}

Generate 3 clarifying questions.`;

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
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 200,
        stream: false,
      }),
    });

    if (!res.ok) {
      console.error("[clarify] OpenRouter error:", res.status);
      return NextResponse.json(SAFE_DEFAULT);
    }

    const data = (await res.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices[0]?.message?.content ?? "";

    // Strip markdown fences if present
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as { questions?: unknown };
      const qs = parsed.questions;
      if (Array.isArray(qs) && qs.length >= 3) {
        return NextResponse.json({
          questions: [String(qs[0]), String(qs[1]), String(qs[2])],
        });
      }
      return NextResponse.json(SAFE_DEFAULT);
    } catch {
      console.error("[clarify] JSON parse failed:", cleaned);
      return NextResponse.json(SAFE_DEFAULT);
    }
  } catch (err) {
    console.error("[clarify] fetch error:", err);
    return NextResponse.json(SAFE_DEFAULT);
  }
}
