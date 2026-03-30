import { NextRequest, NextResponse } from "next/server";
import { type DebateSummary } from "@/lib/types";
import { openRouterReferer } from "@/lib/openrouter-referer";

// ── Types ────────────────────────────────────────────────────────────────────

interface SummarizeRequestBody {
  topic?: string;
  allMessages?: Array<{ model: string; content: string; round: number }>;
  model?: string;
}

const GEMINI_SUMMARIZER = "google/gemini-2.0-flash-001";

const SAFE_DEFAULT: DebateSummary = {
  generatedBy: "gemini",
  consensus: "Unable to generate",
  coreTension: "Unable to generate",
  strongestArgument: "Unable to generate",
  practicalTakeaway: "Unable to generate",
  openQuestions: "Unable to generate",
};

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<DebateSummary>> {
  const body = (await req.json()) as SummarizeRequestBody;
  const { topic = "", allMessages = [], model = GEMINI_SUMMARIZER } = body;

  const systemPrompt = `You are synthesizing a structured multi-model AI debate into a decision-quality summary.

Return ONLY valid JSON, no other text:
{
  "consensus": "string",
  "coreTension": "string",
  "strongestArgument": "string",
  "practicalTakeaway": "string",
  "openQuestions": "string"
}

Rules:
- consensus: what all models agreed on (2-3 sentences)
- coreTension: the central unresolved disagreement (2-3 sentences)
- strongestArgument: the single best point made and which model made it (2-3 sentences)
- practicalTakeaway: what should the human actually do or think differently (2-4 sentences)
- openQuestions: what this debate did not resolve (2-3 sentences)

Be specific. Name models when attributing points. Do not pick a winner. Do not be vague.`;

  const transcript = allMessages
    .map((m) => `[Round ${m.round}] ${m.model}: ${m.content}`)
    .join("\n\n");

  const userPrompt = `Topic: ${topic}

Full debate transcript:
${transcript}

Produce the summary now.`;

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
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
        stream: false,
      }),
    });

    if (!res.ok) {
      console.error("[summarize] OpenRouter error:", res.status);
      return NextResponse.json(SAFE_DEFAULT);
    }

    const data = (await res.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices[0]?.message?.content ?? "";

    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as Partial<DebateSummary>;
      return NextResponse.json({
        generatedBy: "gemini",
        consensus: parsed.consensus ?? SAFE_DEFAULT.consensus,
        coreTension: parsed.coreTension ?? SAFE_DEFAULT.coreTension,
        strongestArgument: parsed.strongestArgument ?? SAFE_DEFAULT.strongestArgument,
        practicalTakeaway: parsed.practicalTakeaway ?? SAFE_DEFAULT.practicalTakeaway,
        openQuestions: parsed.openQuestions ?? SAFE_DEFAULT.openQuestions,
      });
    } catch {
      console.error("[summarize] JSON parse failed:", cleaned);
      return NextResponse.json(SAFE_DEFAULT);
    }
  } catch (err) {
    console.error("[summarize] fetch error:", err);
    return NextResponse.json(SAFE_DEFAULT);
  }
}
