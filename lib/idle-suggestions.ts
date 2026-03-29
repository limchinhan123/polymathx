/** Session-scoped idle topic chips: same 3 for the tab until login, new topic, or pool clear. */

export const PMX_SUGGESTIONS_KEY = "pmx_suggestions";

export const SUGGESTION_POOL = [
  "Is AGI inevitable by 2030?",
  "Should AI have legal personhood?",
  "Is remote work better than office?",
  "Should universities ban AI-written essays?",
  "Is universal basic income inevitable if AI automates jobs?",
  "Do we need a global treaty on autonomous weapons?",
  "Is privacy dead in the age of AI surveillance?",
  "Should social platforms be liable for algorithmic harm?",
  "Is the four-day workweek realistic at scale?",
  "Should carbon credits be traded on open markets?",
  "Is space colonization a moral obligation or a distraction?",
  "Would you trust an AI judge for minor civil disputes?",
  "Is nostalgia harmful to progress?",
  "Should children learn to code before they learn a second language?",
  "Is meritocracy compatible with inherited wealth?",
  "Should elected officials be required to disclose AI use?",
  "Is the attention economy sustainable?",
  "Should deepfakes be criminalized by default?",
];

export function pickRandomTopics(pool: string[], count: number): string[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

export function getOrPickIdleSuggestions(): string[] {
  if (typeof window === "undefined") {
    return pickRandomTopics(SUGGESTION_POOL, 3);
  }
  try {
    const raw = sessionStorage.getItem(PMX_SUGGESTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.length === 3 &&
        parsed.every((x) => typeof x === "string")
      ) {
        return parsed as string[];
      }
    }
  } catch {
    // fall through to pick
  }
  const picked = pickRandomTopics(SUGGESTION_POOL, 3);
  sessionStorage.setItem(PMX_SUGGESTIONS_KEY, JSON.stringify(picked));
  return picked;
}

export function clearIdleSuggestionsCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PMX_SUGGESTIONS_KEY);
}
