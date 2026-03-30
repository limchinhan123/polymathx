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

const FORMAT_RULES = `CRITICAL FORMAT RULE: Do not use any markdown formatting whatsoever. No asterisks, no bold, no italic, no bullet points, no numbered lists, no headers. Plain prose paragraphs only. Any asterisk character is strictly forbidden.

FORMAT RULES — follow strictly:
- Write in flowing paragraphs only
- No bullet points, numbered lists, or headers
- No bold or italic markdown formatting
- No asterisks of any kind
- Respond as if writing an opinion essay
- One to three paragraphs maximum`;

const NO_QUESTIONS_TO_HUMAN = `Do not ask the human any questions. You are debating with other AI models, not interviewing the human. If you need context, state your assumption explicitly instead. Example: 'Assuming this is for a B2C product...' then proceed.`;

const DEBATE_DIRECTED_AT_MODELS = `You are debating OTHER AI MODELS, not the human. Direct your arguments at Claude, GPT-4o, or Gemini by name. The human is observing, not participating.`;

const MODEL_OUTPUT_CONSTRAINTS = `${FORMAT_RULES}

${NO_QUESTIONS_TO_HUMAN}`;

const BLACK_HAT_DEBATER_SYSTEM = `You are the Black Hat debater. Your job is to:
1. Actively argue against the prevailing view
2. Find every reason why the proposed idea will fail
3. Identify risks, blind spots, and worst-case scenarios the other models are ignoring
4. Be pessimistic but specific — not cynical for its own sake
5. Steel-man the opposing view only to then demolish it
Do not be balanced. Stress-test ruthlessly.
150-200 words. Be direct.

${DEBATE_DIRECTED_AT_MODELS}

${MODEL_OUTPUT_CONSTRAINTS}`;

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

const CLAUDE_MODEL_MAP: Record<string, string> = {
  "claude-3-5-sonnet-20241022": "anthropic/claude-sonnet-4.6",
  "claude-3-haiku-20240307": "anthropic/claude-haiku-4.5",
};

/** Sonnet debater: try in order until one succeeds (Haiku uses a single model only). */
const CLAUDE_SONNET_FALLBACKS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-3.5-sonnet",
] as const;

const BLACK_HAT_MODEL = "deepseek/deepseek-r1";

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

interface Round1ByModel {
  claude?: string;
  gpt?: string;
  gemini?: string;
  blackHat?: string;
}

interface PreviousResponses {
  claude?: string;
  gpt?: string;
  gemini?: string;
  blackHat?: string;
}

interface AttachedFilePayload {
  name: string;
  type: "pdf" | "docx" | "image";
  text?: string;
  base64?: string;
  isImage: boolean;
}

interface DebateRequestBody {
  topic?: string;
  /** Current debater round (1-indexed). */
  round?: number;
  clarifications?: string[];
  settings?: DebateSettings;
  previousResponses?: PreviousResponses;
  round1ByModel?: Round1ByModel;
  /** Each model's round-1 text for position anchoring in round 2+ (merged over round1ByModel when both sent). */
  ownPreviousResponse?: Round1ByModel;
  moderatorQuestion?: string;
  attachedFile?: AttachedFilePayload;
}

type ChatMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
};

// ── OpenAI client (lazy) ────────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  openaiClient ??= new OpenAI({ apiKey: key });
  return openaiClient;
}


// ── Post-process streamed text (models still emit markdown sometimes) ───────

/** Same transforms as stripMarkdown but no `.trim()` — safe between SSE chunks so words are not glued. */
function stripMarkdownChunk(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/^\s*[-•]\s/gm, "")
    .replace(/^\s*\d+\.\s/gm, "");
}

function stripMarkdown(text: string): string {
  return stripMarkdownChunk(text).trim();
}

// ── Streaming helpers ───────────────────────────────────────────────────────

async function streamFromOpenRouter(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  onChunk: (text: string) => void
): Promise<void> {
  const serializedMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": openRouterReferer(),
      "X-Title": "Polymath X",
    },
    body: JSON.stringify({ model, messages: serializedMessages, temperature, max_tokens: 400, stream: true }),
  });

  if (!response.ok || !response.body) {
    const errBody = await response.text();
    console.error(
      "[debate] OpenRouter error response",
      JSON.stringify({ model, status: response.status, body: errBody })
    );
    throw new Error(`OpenRouter ${response.status}: ${errBody}`);
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
        if (text) onChunk(stripMarkdownChunk(text));
      } catch {
        /* skip */
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
    /* eslint-disable-next-line */
    messages: messages as any,
    temperature,
    max_tokens: 400,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? "";
    if (text) onChunk(stripMarkdownChunk(text));
  }
}

async function streamClaudeDebate(
  resolvedClaudeModel: string,
  messages: ChatMessage[],
  temperature: number,
  onChunk: (text: string) => void
): Promise<void> {
  const isHaiku = resolvedClaudeModel.toLowerCase().includes("haiku");
  const models: string[] = isHaiku ? [resolvedClaudeModel] : [...CLAUDE_SONNET_FALLBACKS];
  let lastErr: unknown;
  for (const model of models) {
    try {
      await streamFromOpenRouter(model, messages, temperature, onChunk);
      return;
    } catch (err) {
      lastErr = err;
      console.error(`[debate] Claude OpenRouter model failed (${model}), trying fallback if any`, err);
    }
  }
  throw lastErr;
}

// ── Position anchor (round 2+) ──────────────────────────────────────────────

function positionAnchorBlock(ownRound1: string | undefined): string {
  const t = ownRound1?.trim() ?? "";
  if (!t) return "";
  return `YOUR POSITION FROM ROUND 1:
${JSON.stringify(t)}

You must maintain consistency with this position. Begin your response by restating your core argument in one sentence. Only change your position if you explicitly state: 'I am updating my position because...' followed by the specific reason.

Do not contradict what you said in round 1 without acknowledgment. You are the same debater continuing an argument, not starting fresh.

`;
}

// ── File context injection ───────────────────────────────────────────────────

/**
 * For text-based files (PDF/DOCX): appends the extracted text to the user message string.
 * For images: replaces the user message content with an array containing the image + text.
 * Only applied to Round 1 (subsequent rounds already have context in the thread).
 */
function injectFileContext(
  messages: ChatMessage[],
  file: AttachedFilePayload | undefined,
  supportsVision: boolean
): ChatMessage[] {
  if (!file) return messages;

  return messages.map((msg, idx) => {
    // Only touch the last user message
    if (msg.role !== "user" || idx !== messages.length - 1) return msg;

    if (file.isImage && file.base64 && supportsVision) {
      return {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: file.base64 } },
          {
            type: "text" as const,
            text: String(msg.content),
          },
        ],
      };
    }

    if (!file.isImage && file.text) {
      const suffix = `\n\nATTACHED DOCUMENT — '${file.name}':\n${file.text}\n\nThe human wants you to use this document as context for the debate.\nIf the topic is about the document itself, debate its content directly.\nIf the topic is a separate question, use the document as background context.`;
      return {
        ...msg,
        content: String(msg.content) + suffix,
      };
    }

    return msg;
  });
}

// ── Prompt builders ─────────────────────────────────────────────────────────

function humanContextPrefix(clarifications: string[]): string {
  if (clarifications.length === 0) return "";
  return `Context from the human:
${clarifications.join("\n\n")}

`;
}

function round1Prompts(
  modelName: string,
  personaDef: string,
  styleDef: string,
  topic: string,
  clarifications: string[]
): ChatMessage[] {
  const ctx = humanContextPrefix(clarifications);
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

Respond in 150-200 words. Be direct.

${DEBATE_DIRECTED_AT_MODELS}

${MODEL_OUTPUT_CONSTRAINTS}`,
    },
    {
      role: "user",
      content: `${ctx}Topic: ${topic}

Give your assessment now.`,
    },
  ];
}

function blackHatRound1Messages(topic: string, clarifications: string[]): ChatMessage[] {
  const ctx = humanContextPrefix(clarifications);
  return [
    { role: "system", content: BLACK_HAT_DEBATER_SYSTEM },
    {
      role: "user",
      content: `${ctx}Topic: ${topic}

Give your Black Hat assessment now.`,
    },
  ];
}

function roundNPrompts(
  modelName: string,
  personaDef: string,
  styleDef: string,
  topic: string,
  previousResponses: PreviousResponses,
  moderatorQuestion: string,
  debateRound: number,
  ownRound1: string | undefined
): ChatMessage[] {
  const prevRound = debateRound - 1;
  const header =
    debateRound === 2
      ? "Round 1 responses:"
      : `Responses from round ${prevRound}:`;

  let body = `${header}
Claude: ${previousResponses.claude ?? ""}
GPT-4o: ${previousResponses.gpt ?? ""}
Gemini: ${previousResponses.gemini ?? ""}`;
  if (previousResponses.blackHat !== undefined && previousResponses.blackHat !== "") {
    body += `\nBlack Hat (DeepSeek R1): ${previousResponses.blackHat}`;
  }

  const anchor = positionAnchorBlock(ownRound1);

  return [
    {
      role: "system",
      content: `${anchor}${DEBATE_DIRECTED_AT_MODELS}

You are ${modelName} in round ${debateRound} of a structured debate. Your perspective lens: ${personaDef}
Debate style: ${styleDef}

You have read the previous round responses below.
Your task:
1. Identify the strongest argument made against your likely position
2. Steel-man it fully before responding
3. Either defend your position with stronger evidence, or explicitly state what changed your mind and exactly why

RULES:
- No sycophancy
- No capitulation without explicit reasoning
- Disagree where you see flawed logic
- 150-200 words
- Name the model you are responding to

${MODEL_OUTPUT_CONSTRAINTS}`,
    },
    {
      role: "user",
      content: `Topic: ${topic}

${body}

Moderator's follow-up question:
${moderatorQuestion}

Give your round ${debateRound} response now.`,
    },
  ];
}

function blackHatRoundNMessages(
  topic: string,
  clarifications: string[],
  previousResponses: PreviousResponses,
  moderatorQuestion: string,
  debateRound: number,
  ownRound1: string | undefined
): ChatMessage[] {
  const prevRound = debateRound - 1;
  const header =
    debateRound === 2
      ? "Round 1 responses:"
      : `Responses from round ${prevRound}:`;

  let body = `${header}
Claude: ${previousResponses.claude ?? ""}
GPT-4o: ${previousResponses.gpt ?? ""}
Gemini: ${previousResponses.gemini ?? ""}`;
  if (previousResponses.blackHat !== undefined && previousResponses.blackHat !== "") {
    body += `\nBlack Hat (DeepSeek R1): ${previousResponses.blackHat}`;
  }

  const anchor = positionAnchorBlock(ownRound1);

  return [
    { role: "system", content: `${anchor}${BLACK_HAT_DEBATER_SYSTEM}` },
    {
      role: "user",
      content: `Topic: ${topic}

${body}

Moderator's follow-up question:
${moderatorQuestion}

Give your round ${debateRound} Black Hat response now.`,
    },
  ];
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as DebateRequestBody;
  const {
    topic = "",
    round: debateRound = 1,
    clarifications = [],
    settings = {},
    previousResponses = {},
    round1ByModel = {},
    ownPreviousResponse,
    moderatorQuestion = "",
    attachedFile,
  } = body;
  /** Position anchor source: explicit ownPreviousResponse wins per-field over round1ByModel. */
  const anchorByModel: Round1ByModel = { ...round1ByModel, ...(ownPreviousResponse ?? {}) };
  const isRound1File = debateRound <= 1 && !!attachedFile;

  const temperature = settings.temperature ?? 0.7;
  const debateStyle = settings.debateStyle ?? "Socratic";
  const styleDef = DEBATE_STYLES[debateStyle] ?? DEBATE_STYLES["Socratic"];

  const claudePersona = settings.personas?.claude ?? "First Principles";
  const gptPersona = settings.personas?.gpt ?? "Pragmatist";
  const geminiPersona = settings.personas?.gemini ?? "Data/Evidence";
  const blackHatMode = settings.blackHatMode === true;

  const claudePersonaDef = CLAUDE_PERSONAS[claudePersona] ?? claudePersona;
  const gptPersonaDef = GPT_PERSONAS[gptPersona] ?? gptPersona;
  const geminiPersonaDef = GEMINI_PERSONAS[geminiPersona] ?? geminiPersona;

  let claudeModel = settings.claudeModel ?? "anthropic/claude-sonnet-4.6";
  if (CLAUDE_MODEL_MAP[claudeModel]) claudeModel = CLAUDE_MODEL_MAP[claudeModel];
  const gptModel = settings.gptModel ?? "gpt-4o";
  const geminiModel = settings.geminiModel ?? "google/gemini-2.0-flash-001";

  const isRound1 = debateRound <= 1;

  const claudeMessages = injectFileContext(
    isRound1
      ? round1Prompts("Claude", claudePersonaDef, styleDef, topic, clarifications)
      : roundNPrompts(
          "Claude",
          claudePersonaDef,
          styleDef,
          topic,
          previousResponses,
          moderatorQuestion,
          debateRound,
          anchorByModel.claude
        ),
    isRound1File ? attachedFile : undefined,
    true // Claude supports vision
  );

  const gptMessages = injectFileContext(
    isRound1
      ? round1Prompts("GPT-4o", gptPersonaDef, styleDef, topic, clarifications)
      : roundNPrompts(
          "GPT-4o",
          gptPersonaDef,
          styleDef,
          topic,
          previousResponses,
          moderatorQuestion,
          debateRound,
          anchorByModel.gpt
        ),
    isRound1File ? attachedFile : undefined,
    true // GPT-4o supports vision
  );

  const geminiMessages = injectFileContext(
    isRound1
      ? round1Prompts("Gemini", geminiPersonaDef, styleDef, topic, clarifications)
      : roundNPrompts(
          "Gemini",
          geminiPersonaDef,
          styleDef,
          topic,
          previousResponses,
          moderatorQuestion,
          debateRound,
          anchorByModel.gemini
        ),
    isRound1File ? attachedFile : undefined,
    true // Gemini Pro 1.5 supports vision
  );

  // Black Hat (non-vision): images are skipped, text docs still injected
  const blackHatMessages =
    blackHatMode &&
    injectFileContext(
      isRound1
        ? blackHatRound1Messages(topic, clarifications)
        : blackHatRoundNMessages(
            topic,
            clarifications,
            previousResponses,
            moderatorQuestion,
            debateRound,
            anchorByModel.blackHat
          ),
      isRound1File ? attachedFile : undefined,
      false // Black Hat: inject text docs but skip images
    );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(model: string, chunk: string, done: boolean) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify({ model, chunk, done }) + "\n"));
        } catch {
          /* closed */
        }
      }

      const tasks: Promise<void>[] = [
        (async () => {
          try {
            await streamClaudeDebate(claudeModel, claudeMessages, temperature, (chunk) =>
              send("claude", chunk, false)
            );
            send("claude", "", true);
          } catch (err) {
            console.error("[debate] claude error (all fallbacks exhausted):", err);
            send("claude", "[Model unavailable — continuing with other models]", false);
            send("claude", "", true);
          }
        })(),
        (async () => {
          try {
            await streamFromOpenAI(gptModel, gptMessages, temperature, (chunk) =>
              send("gpt4o", chunk, false)
            );
            send("gpt4o", "", true);
          } catch (err) {
            console.error("[debate] gpt4o error:", err);
            send("gpt4o", "[Model unavailable — continuing with other models]", false);
            send("gpt4o", "", true);
          }
        })(),
        (async () => {
          try {
            await streamFromOpenRouter(geminiModel, geminiMessages, temperature, (chunk) =>
              send("gemini", chunk, false)
            );
            send("gemini", "", true);
          } catch (err) {
            console.error("[debate] gemini error:", err);
            send("gemini", "[Model unavailable — continuing with other models]", false);
            send("gemini", "", true);
          }
        })(),
      ];

      if (blackHatMode && blackHatMessages) {
        tasks.push(
          (async () => {
            try {
              await streamFromOpenRouter(BLACK_HAT_MODEL, blackHatMessages, temperature, (chunk) => {
                // DeepSeek R1 emits <think>…</think> reasoning tokens — strip them (chunk is already markdown-stripped)
                const clean = chunk.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<\/?think>/g, "");
                if (clean) send("blackHat", clean, false);
              });
              send("blackHat", "", true);
            } catch (err) {
              console.error("[debate] blackHat error:", err);
              send("blackHat", "[Model unavailable — continuing without Black Hat debater]", false);
              send("blackHat", "", true);
            }
          })()
        );
      }

      await Promise.allSettled(tasks);

      try {
        controller.close();
      } catch {
        /* */
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
