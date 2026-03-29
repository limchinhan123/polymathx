/** Map Settings-tab model ids to OpenRouter `model` strings. */

export function toOpenRouterModeratorModel(settingsId: string): string {
  if (settingsId === "claude-3-haiku-20240307") return "anthropic/claude-haiku-4-5";
  return settingsId;
}

export function toOpenRouterSummarizerModel(settingsId: string): string {
  if (settingsId === "claude-3-5-sonnet-20241022") return "anthropic/claude-sonnet-4-5";
  if (settingsId === "claude-3-haiku-20240307") return "anthropic/claude-haiku-4-5";
  return settingsId;
}
