/** Map Settings-tab model ids to OpenRouter `model` strings (legacy / optional overrides). */

import type { ModelId } from "./types";

export function toOpenRouterModeratorModel(settingsId: string): string {
  if (settingsId === "claude-3-haiku-20240307") return "anthropic/claude-haiku-4.5";
  if (settingsId === "mistralai/mistral-large") return "mistralai/mistral-large";
  return settingsId;
}

export function toOpenRouterSummarizerModel(settingsId: string): string {
  // Legacy setting ids → current OpenRouter slugs
  if (settingsId === "google/gemini-pro-1.5") return "google/gemini-2.0-flash-001";
  if (settingsId === "claude-3-5-sonnet-20241022") return "anthropic/claude-sonnet-4.5";
  if (settingsId === "claude-3-haiku-20240307") return "anthropic/claude-haiku-4.5";
  return settingsId;
}

/** Which debater avatar to show while /api/summarize is running. */
export function summarizerTypingModel(settingsSummarizerId: string): ModelId {
  const m = toOpenRouterSummarizerModel(settingsSummarizerId).toLowerCase();
  if (m.includes("gemini")) return "gemini";
  return "claude";
}
