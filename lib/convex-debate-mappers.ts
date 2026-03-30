import type { Doc } from "@/convex/_generated/dataModel";
import type { DebateSettings, DebateSummary, Message, ModelId } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const MODEL_IDS: ModelId[] = ["claude", "gpt4o", "gemini", "deepseek", "blackHat"];

/** Persisted debates may still store the old id `grok`. */
function asModelId(raw: string): ModelId {
  const normalized = raw === "grok" ? "blackHat" : raw;
  return MODEL_IDS.includes(normalized as ModelId) ? (normalized as ModelId) : "claude";
}

/** Convex `settings` document shape (see convex/schema.ts). */
export function mapSettingsForConvex(settings: DebateSettings) {
  return {
    claudeModel: settings.claudeModel,
    gptModel: settings.gptModel,
    geminiModel: settings.geminiModel,
    moderator: settings.moderatorModel,
    summarizer: settings.summarizerModel,
    temperature: settings.temperature,
    debateStyle: settings.debateStyle,
    personas: {
      claude: settings.claudePersona,
      gpt: settings.gptPersona,
      gemini: settings.geminiPersona,
    },
    blackHatMode: settings.blackHatMode,
  };
}

/** Convex `messages` row shape (timestamp stored as string). */
export function mapMessagesForConvex(messages: Message[]) {
  return messages.map((m) => ({
    id: m.id,
    model: m.model,
    personaTag: m.personaTag,
    content: m.content,
    round: m.round,
    timestamp: String(m.timestamp),
    isModerator: m.isModerator,
  }));
}

export function summaryToConvexString(summary: DebateSummary): string {
  return JSON.stringify(summary);
}

export function mapMessagesFromConvex(messages: Doc<"debates">["messages"]): Message[] {
  return messages.map((m) => {
    const model = asModelId(m.model);
    return {
      id: m.id,
      model,
      role: m.isModerator ? "moderator" : "model",
      personaTag: m.personaTag,
      content: m.content,
      round: m.round,
      timestamp: Number.parseInt(m.timestamp, 10) || 0,
      isModerator: m.isModerator,
      isStreaming: false,
      ...(model === "blackHat" ? { blackHat: true } : {}),
    };
  });
}

export function mapSettingsFromConvex(s: Doc<"debates">["settings"]): DebateSettings {
  return {
    ...DEFAULT_SETTINGS,
    claudeModel: s.claudeModel as DebateSettings["claudeModel"],
    gptModel: s.gptModel as DebateSettings["gptModel"],
    geminiModel: s.geminiModel as DebateSettings["geminiModel"],
    moderatorModel: s.moderator as DebateSettings["moderatorModel"],
    summarizerModel: s.summarizer as DebateSettings["summarizerModel"],
    temperature: s.temperature,
    debateStyle: s.debateStyle as DebateSettings["debateStyle"],
    blackHatMode: s.blackHatMode ?? false,
    claudePersona: s.personas.claude as DebateSettings["claudePersona"],
    gptPersona: s.personas.gpt as DebateSettings["gptPersona"],
    geminiPersona: s.personas.gemini as DebateSettings["geminiPersona"],
  };
}

function normalizeSummaryGeneratedBy(raw: string): ModelId {
  const normalized = raw === "grok" ? "blackHat" : raw;
  return MODEL_IDS.includes(normalized as ModelId) ? (normalized as ModelId) : "gemini";
}

export function summaryFromConvexString(raw: string | undefined): DebateSummary | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as DebateSummary;
    if (
      o &&
      typeof o.consensus === "string" &&
      typeof o.coreTension === "string" &&
      typeof o.generatedBy === "string"
    ) {
      return { ...o, generatedBy: normalizeSummaryGeneratedBy(o.generatedBy) };
    }
  } catch {
    /* ignore */
  }
  return null;
}
