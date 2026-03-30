/** Map Settings-tab model ids to OpenRouter `model` strings (legacy / optional overrides). */

export function toOpenRouterModeratorModel(settingsId: string): string {
  if (settingsId === "claude-3-haiku-20240307") return "anthropic/claude-haiku-4-5";
  if (settingsId === "mistralai/mistral-large") return "mistralai/mistral-large";
  return settingsId;
}

export function toOpenRouterSummarizerModel(settingsId: string): string {
  if (settingsId === "google/gemini-pro-1.5") return "google/gemini-pro-1.5";
  if (settingsId === "claude-3-5-sonnet-20241022") return "anthropic/claude-sonnet-4-5";
  if (settingsId === "claude-3-haiku-20240307") return "anthropic/claude-haiku-4-5";
  return settingsId;
}
