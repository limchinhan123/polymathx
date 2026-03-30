import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { DebateSummary } from "@/lib/types";

export interface JudgeRequestBody {
  topic?: string;
  allMessages?: Array<{ model: string; content: string; round: number }>;
  summary?: Partial<DebateSummary>;
}

export interface JudgeResponseBody {
  verdict: string;
  reasoning: string;
  mvp: string;
  dissent: string;
  ruling: string;
}

const SAFE_DEFAULT: JudgeResponseBody = {
  verdict: "Unable to produce a verdict.",
  reasoning: "The judge service did not return valid output.",
  mvp: "—",
  dissent: "—",
  ruling: "No ruling available.",
};

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  openaiClient ??= new OpenAI({ apiKey: key });
  return openaiClient;
}

const SYSTEM_PROMPT = `You are the Judge in a structured AI debate. You have read the full transcript and summary.
Your job is to deliver a fair, reasoned verdict.

Return ONLY valid JSON, no other text:
{
  "verdict": "string",
  "reasoning": "string",
  "mvp": "string",
  "dissent": "string",
  "ruling": "string"
}

Definitions:
- verdict: which model made the strongest overall argument and why (2-3 sentences)
- reasoning: the specific logical basis for your verdict (3-4 sentences)
- mvp: the single best individual point made in the entire debate, and who made it (1-2 sentences)
- dissent: what the losing side got right that deserves acknowledgment (2 sentences)
- ruling: one definitive sentence summarizing the debate outcome

Rules:
- Be specific, name models when attributing
- Do not be diplomatic — pick a winner
- Base verdict on argument quality, not which position you agree with
- Acknowledge strong points on losing side

FORMAT RULES for every JSON string value (verdict, reasoning, mvp, dissent, ruling) — follow strictly:
- Plain prose only: flowing sentences and short paragraphs where needed
- No bullet points, numbered lists, or headers
- No bold or italic markdown, no asterisks`;

export async function POST(req: NextRequest): Promise<NextResponse<JudgeResponseBody>> {
  const body = (await req.json()) as JudgeRequestBody;
  const { topic = "", allMessages = [], summary = {} } = body;

  const transcript = allMessages
    .map((m) => `[Round ${m.round}] ${m.model}: ${m.content}`)
    .join("\n\n");

  const userPrompt = `Topic: ${topic}

Full debate transcript:
${transcript}

Summary provided:
Consensus: ${summary.consensus ?? ""}
Core Tension: ${summary.coreTension ?? ""}
Strongest Argument: ${summary.strongestArgument ?? ""}

Deliver your verdict now.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as Partial<JudgeResponseBody>;
      return NextResponse.json({
        verdict: parsed.verdict ?? SAFE_DEFAULT.verdict,
        reasoning: parsed.reasoning ?? SAFE_DEFAULT.reasoning,
        mvp: parsed.mvp ?? SAFE_DEFAULT.mvp,
        dissent: parsed.dissent ?? SAFE_DEFAULT.dissent,
        ruling: parsed.ruling ?? SAFE_DEFAULT.ruling,
      });
    } catch {
      console.error("[judge] JSON parse failed:", cleaned);
      return NextResponse.json(SAFE_DEFAULT);
    }
  } catch (err) {
    console.error("[judge] OpenAI error:", err);
    return NextResponse.json(SAFE_DEFAULT);
  }
}
