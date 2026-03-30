export interface DebatePayload {
  topic: string;
  /** Current debater round (1, 2, 3, …). */
  round: number;
  /** Same as `round` when starting that round — API prefers this when set. */
  pendingRound?: number;
  clarifications: string[];
  settings: {
    claudeModel: string;
    gptModel: string;
    geminiModel: string;
    temperature: number;
    debateStyle: string;
    personas: {
      claude: string;
      gpt: string;
      gemini: string;
    };
    blackHatMode?: boolean;
  };
  previousResponses?: {
    claude: string;
    gpt: string;
    gemini: string;
    blackHat?: string;
  };
  /** Each model's round-1 output — server uses for position anchoring in round 2+. */
  round1ByModel?: {
    claude?: string;
    gpt?: string;
    gemini?: string;
    blackHat?: string;
  };
  /** Same data as round1ByModel; explicit name for position anchoring (merged on server). */
  ownPreviousResponse?: {
    claude?: string;
    gpt?: string;
    gemini?: string;
    blackHat?: string;
  };
  moderatorQuestion?: string;
  attachedFile?: {
    name: string;
    type: "pdf" | "docx" | "image";
    text?: string;
    base64?: string;
    isImage: boolean;
  };
}

function normalizeStreamModelId(model: string): string {
  return model === "grok" ? "blackHat" : model;
}

export async function streamDebate(
  payload: DebatePayload,
  onChunk: (model: string, chunk: string) => void,
  onComplete: (model: string, fullText: string) => void
): Promise<void> {
  const response = await fetch("/api/debate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Debate API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const accumulated: Record<string, string> = {
    claude: "",
    gpt4o: "",
    gemini: "",
    blackHat: "",
  };

  const expectedModels: string[] = ["claude", "gpt4o", "gemini"];
  if (payload.settings.blackHatMode === true) {
    expectedModels.push("blackHat");
  }
  const completed = new Set<string>();

  let carry = "";

  while (true) {
    const { done, value } = await reader.read();
    carry += decoder.decode(value, { stream: !done });
    const parts = carry.split("\n");
    carry = parts.pop() ?? "";

    for (const raw of parts) {
      const line = raw.replace(/\r$/, "").trimEnd();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line) as {
          model: string;
          chunk: string;
          done: boolean;
        };

        const model = normalizeStreamModelId(parsed.model);

        if (!parsed.done) {
          accumulated[model] = (accumulated[model] ?? "") + parsed.chunk;
          onChunk(model, parsed.chunk);
        } else {
          completed.add(model);
          onComplete(model, accumulated[model] ?? "");
        }
      } catch {
        /* Skip malformed lines */
      }
    }

    if (done) break;
  }

  // If the connection closed without a terminal `done` for a model, stop the spinner anyway.
  for (const m of expectedModels) {
    if (!completed.has(m)) {
      onComplete(m, accumulated[m] ?? "");
    }
  }
}
