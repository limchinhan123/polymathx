import { NextRequest } from "next/server";
import OpenAI from "openai";
import { openRouterReferer } from "@/lib/openrouter-referer";

// ── Persona + style maps ────────────────────────────────────────────────────

const CLAUDE_PERSONAS: Record<string, string> = {
  "First Principles":
    "Reason from fundamentals. Ignore convention. Ask what is actually true, not what is assumed.",
  Contrarian:
    "Challenge the dominant view. Find what everyone is missing or taking for granted.",
  Ethicist:
    "Evaluate moral implications and second-order consequences. Who benefits, who is harmed?",
  Strategist:
    "Focus on competitive dynamics, incentives, and long-term positioning.",
};

const GPT_PERSONAS: Record<string, string> = {
  Pragmatist:
    "Focus on what works in practice. Challenge theoretical ideals with real-world friction.",
  Historicist:
    "Use historical precedent. What has actually happened in similar cases?",
  Optimist: "Find the opportunity. What could go right if executed well?",
  "Devil's Advocate":
    "Actively argue the opposing view, even if you partially agree.",
};

const GEMINI_PERSONAS: Record<string, string> = {
  "Data/Evidence":
    "Demand evidence. Reference research. Challenge unsupported claims.",
  Futurist:
    "Focus on where things are heading, not where they are today.",
  Skeptic:
    "Question every assumption. What could go wrong? What is being overlooked?",
  "Systems Thinker":
    "Map the interconnections. What are the feedback loops and unintended consequences?",
};

/** Full lens for Gemini when Black Hat mode is enabled (replaces normal persona). */
const GEMINI_BLACK_HAT_LENS = `You are playing the Black Hat role in this debate. Your job is to:
1. Actively argue against the prevailing view
2. Find every reason why the proposed idea will fail
3. Identify risks, blind spots, and worst-case scenarios others are ignoring
4. Be pessimistic but specific — not cynical for its own sake
Do not be balanced. Your job is to stress-test the idea ruthlessly.`;

const DEBATE_STYLES: Record<string, string> = {
  "Steel-man":
    "Before critiquing any position, first articulate the strongest possible version of it.",
  Socratic:
    "Use probing questions to expose hidden assumptions. Do not just assert — interrogate.",
  "Devil's Advocate":
    "Actively challenge the prevailing view. Disagree by default until proven wrong.",
  Collaborative:
    "Build on others' points and find synthesis, but do not abandon your position without reason.",
};

// Map old model IDs → OpenRouter format
const CLAUDE_MODEL_MAP: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "anthropic/claude-sonnet-4-5",
  "claude-3-haiku-20240307": "anthropic/claude-haiku-4-5",
};

// ── Types ───────────────────────────────────────────────────────────────────

interface DebateSettings {
  claudeModel?: string;
  gptModel?: string;
  geminiModel?: string;
  temperature?: number;
  debateStyle?: string;
  blackHatMode?: boolean;
  personas?: { claude?: string; gpt?: string; gemini?: string };
}

interface DebateRequestBody {
  topic?: string;
  round?: number;
  clarifications?: string[];
  settings?: DebateSettings;
  previousResponses?: { claude?: string; gpt?: string; gemini?: string };
  moderatorQuestion?: string;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// ── OpenAI client (lazy: avoid build-time init when OPENAI_API_KEY is unset) ─

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  openaiClient ??= new OpenAI({ apiKey: key });
  return openaiClient;
}

// ── Streaming helpers ───────────────────────────────────────────────────────

async function streamFromOpenRouter(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  onChunk: (text: string) => void
): Promise<void> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": openRouterReferer(),
      "X-Title": "Polymath X",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 400, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder
      .decode(value, { stream: true })
      .split("\n")
      .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]");
    for (const line of lines) {
      try {
        const json = JSON.parse(line.slice(6)) as {
          choices: Array<{ delta?: { content?: string } }>;
        };
        const text = json.choices[0]?.delta?.content ?? "";
        if (text) onChunk(text);
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

async function streamFromOpenAI(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  onChunk: (text: string) => void
): Promise<void> {
  const stream = await getOpenAI().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: 400,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) onChunk(text);
  }
}

// ── Prompt builders ─────────────────────────────────────────────────────────

function round1Prompts(
  modelName: string,
  personaDef: string,
  styleDef: string,
  topic: string,
  clarifications: string[]
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are ${modelName}, one of three AI models participating in a structured debate.

Your perspective lens: ${personaDef}
Debate style instruction: ${styleDef}

DEBATE RULES — follow these strictly:
1. No sycophancy — never open by praising another model or the question
2. No capitulation — if you change position, state the exact reason
3. Be specific — reference the exact claim you are challenging
4. Depth over breadth — one strong argument beats three weak ones
5. No hedging — commit to a position, qualify only when essential
6. Steel-man first — state the strongest version of the opposing view before critiquing
7. Flag your assumptions — if your argument rests on an assumption, name it

Respond in 150-200 words. Be direct.`,
    },
    {
      role: "user",
      content: `Topic: ${topic}

Clarifications from the human:
${clarifications.length > 0 ? clarifications.join("\n") : "None provided"}

Give your assessment now.`,
    },
  ];
}

function round2Prompts(
  modelName: string,
  personaDef: string,
  styleDef: string,
  topic: string,
  previousResponses: { claude?: string; gpt?: string; gemini?: string },
  moderatorQuestion: string
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are ${modelName} in round 2 of a structured debate. Your perspective lens: ${personaDef}
Debate style: ${styleDef}

You have read the round 1 responses below.
Your task:
1. Identify the strongest argument made against your likely position
2. Steel-man it fully before responding
3. Either defend your position with stronger evidence, or explicitly state what changed your mind and exactly why

RULES:
- No sycophancy
- No capitulation without explicit reasoning
- Disagree where you see flawed logic
- 150-200 words
- Name the model you are responding to`,
    },
    {
      role: "user",
      content: `Topic: ${topic}

Round 1 responses:
Claude: ${previousResponses.claude ?? ""}
GPT-4o: ${previousResponses.gpt ?? ""}
Gemini: ${previousResponses.gemini ?? ""}

Moderator's follow-up question:
${moderatorQuestion}

Give your round 2 response now.`,
    },
  ];
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as DebateRequestBody;
  const {
    topic = "",
    round = 1,
    clarifications = [],
    settings = {},
    previousResponses = {},
    moderatorQuestion = "",
  } = body;

  const temperature = settings.temperature ?? 0.7;
  const debateStyle = settings.debateStyle ?? "Socratic";
  const styleDef = DEBATE_STYLES[debateStyle] ?? DEBATE_STYLES["Socratic"];

  const claudePersona = settings.personas?.claude ?? "First Principles";
  const gptPersona = settings.personas?.gpt ?? "Pragmatist";
  const geminiPersona = settings.personas?.gemini ?? "Data/Evidence";
  const blackHatMode = settings.blackHatMode === true;

  const claudePersonaDef = CLAUDE_PERSONAS[claudePersona] ?? claudePersona;
  const gptPersonaDef = GPT_PERSONAS[gptPersona] ?? gptPersona;
  const geminiPersonaDef = blackHatMode
    ? GEMINI_BLACK_HAT_LENS
    : (GEMINI_PERSONAS[geminiPersona] ?? geminiPersona);

  // Map model IDs to OpenRouter format where needed
  let claudeModel = settings.claudeModel ?? "anthropic/claude-sonnet-4-5";
  if (CLAUDE_MODEL_MAP[claudeModel]) claudeModel = CLAUDE_MODEL_MAP[claudeModel];
  const gptModel = settings.gptModel ?? "gpt-4o";
  const geminiModel = settings.geminiModel ?? "google/gemini-2.0-flash-001";

  const buildMessages = (name: string, personaDef: string): ChatMessage[] =>
    round <= 1
      ? round1Prompts(name, personaDef, styleDef, topic, clarifications)
      : round2Prompts(name, personaDef, styleDef, topic, previousResponses, moderatorQuestion);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(model: string, chunk: string, done: boolean) {
        try {
          controller.enqueue(
            encoder.encode(JSON.stringify({ model, chunk, done }) + "\n")
          );
        } catch {
          // controller already closed
        }
      }

      await Promise.allSettled([
        // Claude via OpenRouter
        (async () => {
          try {
            await streamFromOpenRouter(
              claudeModel,
              buildMessages("Claude", claudePersonaDef),
              temperature,
              (chunk) => send("claude", chunk, false)
            );
            send("claude", "", true);
          } catch (err) {
            console.error("[debate] claude error:", err);
            send("claude", "[Model unavailable — continuing with 2 models]", false);
            send("claude", "", true);
          }
        })(),

        // GPT-4o via OpenAI
        (async () => {
          try {
            await streamFromOpenAI(
              gptModel,
              buildMessages("GPT-4o", gptPersonaDef),
              temperature,
              (chunk) => send("gpt4o", chunk, false)
            );
            send("gpt4o", "", true);
          } catch (err) {
            console.error("[debate] gpt4o error:", err);
            send("gpt4o", "[Model unavailable — continuing with 2 models]", false);
            send("gpt4o", "", true);
          }
        })(),

        // Gemini via OpenRouter
        (async () => {
          try {
            await streamFromOpenRouter(
              geminiModel,
              buildMessages("Gemini", geminiPersonaDef),
              temperature,
              (chunk) => send("gemini", chunk, false)
            );
            send("gemini", "", true);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[debate] gemini error:", msg);
            send("gemini", "[Model unavailable — continuing with 2 models]", false);
            send("gemini", "", true);
          }
        })(),
      ]);

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
