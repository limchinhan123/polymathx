import { NextRequest, NextResponse } from "next/server";
import { openRouterReferer } from "@/lib/openrouter-referer";

// ── Types ────────────────────────────────────────────────────────────────────

interface ModerateRequestBody {
  topic?: string;
  model?: string;
  responses?: {
    claude?: string;
    gpt?: string;
    gemini?: string;
    grok?: string;
  };
}

interface ModerateResponseBody {
  tension: string;
  agreementScore: number;
  nextQuestion: string;
}

const MISTRAL_MODERATOR = "mistralai/mistral-large";

const SAFE_DEFAULT: ModerateResponseBody = {
  tension: "Models disagreed on core assumptions",
  agreementScore: 5,
  nextQuestion: "What evidence would change your position?",
};

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<ModerateResponseBody>> {
  const body = (await req.json()) as ModerateRequestBody;
  const { topic = "", responses = {} } = body;

  const systemPrompt = `You are a debate moderator analyzing responses from AI models. Be precise and analytical.

Return ONLY valid JSON, no other text:
{
  "tension": "string",
  "agreementScore": number,
  "nextQuestion": "string"
}

Rules:
- tension: sharpest unresolved disagreement, max 30 words
- agreementScore: 0-10, where 10 = full consensus
- nextQuestion: one pointed follow-up question, max 25 words

FORMAT RULES for the string fields "tension" and "nextQuestion" — follow strictly:
- Each value must be one or two plain sentences only
- No bullet points, numbered lists, or headers
- No bold or italic markdown, no asterisks`;

  let userPrompt = `Topic: ${topic}

Claude said: ${responses.claude ?? ""}
GPT-4o said: ${responses.gpt ?? ""}
Gemini said: ${responses.gemini ?? ""}`;
  if (responses.grok !== undefined && responses.grok !== "") {
    userPrompt += `\nGrok said: ${responses.grok}`;
  }
  userPrompt += `\n\nIdentify the tension, score agreement, and pose the next question.`;

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
        model: MISTRAL_MODERATOR,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
        stream: false,
      }),
    });

    if (!res.ok) {
      console.error("[moderate] OpenRouter error:", res.status);
      return NextResponse.json(SAFE_DEFAULT);
    }

    const data = (await res.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices[0]?.message?.content ?? "";

    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as Partial<ModerateResponseBody>;
      return NextResponse.json({
        tension: parsed.tension ?? SAFE_DEFAULT.tension,
        agreementScore:
          typeof parsed.agreementScore === "number"
            ? Math.min(10, Math.max(0, parsed.agreementScore))
            : SAFE_DEFAULT.agreementScore,
        nextQuestion: parsed.nextQuestion ?? SAFE_DEFAULT.nextQuestion,
      });
    } catch {
      console.error("[moderate] JSON parse failed:", cleaned);
      return NextResponse.json(SAFE_DEFAULT);
    }
  } catch (err) {
    console.error("[moderate] fetch error:", err);
    return NextResponse.json(SAFE_DEFAULT);
  }
}
