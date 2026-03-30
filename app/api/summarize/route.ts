import { NextRequest, NextResponse } from "next/server";
import { type DebateSummary, type ModelId } from "@/lib/types";
import { openRouterReferer } from "@/lib/openrouter-referer";

// ── Types ────────────────────────────────────────────────────────────────────

interface SummarizeRequestBody {
  topic?: string;
  allMessages?: Array<{ model: string; content: string; round: number }>;
  model?: string;
}

const GEMINI_SUMMARIZER = "google/gemini-2.0-flash-001";

/** Non-streaming OpenRouter calls can hang indefinitely without this. */
const SUMMARIZE_OPENROUTER_TIMEOUT_MS = 90_000;

const SUMMARIZE_MAX_TOKENS = 1200;

const SAFE_DEFAULT: DebateSummary = {
  generatedBy: "gemini",
  consensus: "Unable to generate",
  coreTension: "Unable to generate",
  strongestArgument: "Unable to generate",
  practicalTakeaway: "Unable to generate",
  openQuestions: "Unable to generate",
};

function summarizerGeneratedBy(openRouterModel: string): ModelId {
  const m = openRouterModel.toLowerCase();
  if (m.includes("anthropic") || m.includes("claude")) return "claude";
  return "gemini";
}

function buildSummarizePrompts(topic: string, allMessages: SummarizeRequestBody["allMessages"]) {
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

  const transcript = (allMessages ?? [])
    .map((m) => `[Round ${m.round}] ${m.model}: ${m.content}`)
    .join("\n\n");

  const userPrompt = `Topic: ${topic}

Full debate transcript:
${transcript}

Produce the summary now.`;

  return { systemPrompt, userPrompt };
}

async function summarizeWithOpenRouter(
  model: string,
  topic: string,
  allMessages: SummarizeRequestBody["allMessages"]
): Promise<DebateSummary | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    console.error("[summarize] OPENROUTER_API_KEY is not set");
    return null;
  }

  const { systemPrompt, userPrompt } = buildSummarizePrompts(topic, allMessages);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), SUMMARIZE_OPENROUTER_TIMEOUT_MS);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
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
        max_tokens: SUMMARIZE_MAX_TOKENS,
        stream: false,
      }),
      signal: ac.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[summarize] OpenRouter error:", res.status, errBody.slice(0, 500));
      return null;
    }

    const data = (await res.json()) as {
      choices: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as Partial<DebateSummary>;
      return {
        generatedBy: summarizerGeneratedBy(model),
        consensus: parsed.consensus ?? SAFE_DEFAULT.consensus,
        coreTension: parsed.coreTension ?? SAFE_DEFAULT.coreTension,
        strongestArgument: parsed.strongestArgument ?? SAFE_DEFAULT.strongestArgument,
        practicalTakeaway: parsed.practicalTakeaway ?? SAFE_DEFAULT.practicalTakeaway,
        openQuestions: parsed.openQuestions ?? SAFE_DEFAULT.openQuestions,
      };
    } catch {
      console.error("[summarize] JSON parse failed:", cleaned.slice(0, 400));
      return null;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[summarize] OpenRouter timeout (${SUMMARIZE_OPENROUTER_TIMEOUT_MS}ms) for model`, model);
    } else {
      console.error("[summarize] fetch error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest
): Promise<NextResponse<DebateSummary>> {
  const body = (await req.json()) as SummarizeRequestBody;
  const { topic = "", allMessages = [], model = GEMINI_SUMMARIZER } = body;

  let summary = await summarizeWithOpenRouter(model, topic, allMessages);

  if (!summary && model !== GEMINI_SUMMARIZER) {
    console.warn("[summarize] primary model failed; retrying with Gemini fallback");
    summary = await summarizeWithOpenRouter(GEMINI_SUMMARIZER, topic, allMessages);
    if (summary) {
      summary = { ...summary, generatedBy: "gemini" };
    }
  }

  return NextResponse.json(summary ?? SAFE_DEFAULT);
}
