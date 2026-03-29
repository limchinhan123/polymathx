import type { DebateSettings, DebateSummary, Message } from "./types";

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
