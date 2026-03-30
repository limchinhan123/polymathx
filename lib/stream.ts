export interface DebatePayload {
  topic: string;
  /** Current debater round (1, 2, 3, …). */
  round: number;
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
    grok?: string;
  };
  /** Each model's round-1 output — server uses for position anchoring in round 2+. */
  round1ByModel?: {
    claude?: string;
    gpt?: string;
    gemini?: string;
    grok?: string;
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
    grok: "",
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as {
          model: string;
          chunk: string;
          done: boolean;
        };

        if (!parsed.done) {
          accumulated[parsed.model] = (accumulated[parsed.model] ?? "") + parsed.chunk;
          onChunk(parsed.model, parsed.chunk);
        } else {
          onComplete(parsed.model, accumulated[parsed.model] ?? "");
        }
      } catch {
        /* Skip malformed lines */
      }
    }
  }
}
