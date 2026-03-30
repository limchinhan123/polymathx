// ─── Model identifiers ────────────────────────────────────────────────────────

export type ModelId = "claude" | "gpt4o" | "gemini" | "deepseek" | "blackHat";

const KNOWN_DEBATER_MODELS: ModelId[] = ["claude", "gpt4o", "gemini", "deepseek", "blackHat"];

/** Streams / old saves may still use `grok` for the Black Hat debater. */
export function normalizeLegacyDebaterModelId(model: string): ModelId {
  const m = model === "grok" ? "blackHat" : model;
  return KNOWN_DEBATER_MODELS.includes(m as ModelId) ? (m as ModelId) : "claude";
}

export function isBlackHatDebaterModel(model: string): boolean {
  return model === "blackHat" || model === "grok";
}

export const MODEL_LABELS: Record<ModelId, string> = {
  claude: "Claude",
  gpt4o: "GPT-4o",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  blackHat: "R1",
};

export const MODEL_COLORS: Record<ModelId, string> = {
  claude: "#8B7CF6",
  gpt4o: "#10A37F",
  gemini: "#4285F4",
  deepseek: "#EF9F27",
  blackHat: "#06B6D4",
};

// ─── Debate state machine ─────────────────────────────────────────────────────

export type DebateStatus =
  | "idle"
  | "clarifying"
  | "round1"
  | "moderating"
  | "awaiting_round2"
  | "round2"
  | "continuing"
  | "summarizing"
  | "complete";

// ─── Settings ────────────────────────────────────────────────────────────────

export type ClaudeModel = "claude-3-5-sonnet-20241022" | "claude-3-haiku-20240307";
export type GptModel = "gpt-4o" | "gpt-4o-mini";
export type GeminiModel = "google/gemini-2.0-flash-001" | "google/gemini-flash-1.5-8b";
export type ModeratorModel = "mistralai/mistral-large" | "deepseek/deepseek-chat" | "claude-3-haiku-20240307";
export type SummarizerModel =
  | "google/gemini-2.0-flash-001"
  | "google/gemini-pro-1.5"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-haiku-20240307";

export type DebateStyle = "Steel-man" | "Socratic" | "Devil's Advocate" | "Collaborative";

export type ClaudePersona = "First Principles" | "Contrarian" | "Ethicist" | "Strategist";
export type GptPersona = "Pragmatist" | "Historicist" | "Optimist" | "Devil's Advocate";
export type GeminiPersona = "Data/Evidence" | "Futurist" | "Skeptic" | "Systems Thinker";

export interface DebateSettings {
  claudeModel: ClaudeModel;
  gptModel: GptModel;
  geminiModel: GeminiModel;
  moderatorModel: ModeratorModel;
  summarizerModel: SummarizerModel;
  temperature: number;
  debateStyle: DebateStyle;
  /** When true, DeepSeek R1 joins as a 4th debater in a fixed Black Hat role. */
  blackHatMode: boolean;
  claudePersona: ClaudePersona;
  gptPersona: GptPersona;
  geminiPersona: GeminiPersona;
}

export const DEFAULT_SETTINGS: DebateSettings = {
  claudeModel: "claude-3-5-sonnet-20241022",
  gptModel: "gpt-4o",
  geminiModel: "google/gemini-2.0-flash-001",
  moderatorModel: "mistralai/mistral-large",
  summarizerModel: "google/gemini-2.0-flash-001",
  temperature: 0.7,
  debateStyle: "Socratic",
  blackHatMode: false,
  claudePersona: "First Principles",
  gptPersona: "Pragmatist",
  geminiPersona: "Data/Evidence",
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageRole = "model" | "moderator" | "user" | "system";

export interface Message {
  id: string;
  model: ModelId;
  role: MessageRole;
  personaTag: string;
  content: string;
  round: number;
  timestamp: number;
  isModerator: boolean;
  isStreaming?: boolean;
  agreementScore?: number;
  nextQuestion?: string;
  /** Black Hat debater — show hat badge in the UI. */
  blackHat?: boolean;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface DebateSummary {
  consensus: string;
  coreTension: string;
  strongestArgument: string;
  practicalTakeaway: string;
  openQuestions: string;
  generatedBy: ModelId;
}

// ─── Judge ────────────────────────────────────────────────────────────────────

export interface JudgeVerdict {
  verdict: string;
  reasoning: string;
  mvp: string;
  dissent: string;
  ruling: string;
}

// ─── Clarifying questions ─────────────────────────────────────────────────────

export interface ClarifyingQuestion {
  id: string;
  question: string;
  answer: string;
}

// ─── Attached file ────────────────────────────────────────────────────────────

export interface AttachedFile {
  name: string;
  type: "pdf" | "docx" | "image";
  /** Extracted text for PDF and DOCX. */
  text?: string;
  /** Base64-encoded data URI for images (e.g. "data:image/jpeg;base64,..."). */
  base64?: string;
  isImage: boolean;
}

// ─── Full debate state ────────────────────────────────────────────────────────

export interface DebateState {
  status: DebateStatus;
  topic: string;
  messages: Message[];
  currentRound: number;
  clarifyingQuestions: ClarifyingQuestion[];
  summary: DebateSummary | null;
  settings: DebateSettings;
  drawerOpen: boolean;
  drawerTab: "history" | "settings";
  summaryOpen: boolean;
  clarificationOpen: boolean;
  isLoading: boolean;
  loadingModel: ModelId | null;
  error: string | null;
  agreementScore: number | null;
  judgeVerdict: JudgeVerdict | null;
  judgeLoading: boolean;
  attachedFile: AttachedFile | null;
  /** Optional human notes injected into round-2 model prompts; cleared when round 2 starts. */
  interRoundContext: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type DebateAction =
  | { type: "SET_TOPIC"; payload: string }
  | { type: "START_DEBATE" }
  | { type: "SET_CLARIFYING_QUESTIONS"; payload: ClarifyingQuestion[] }
  | { type: "ANSWER_CLARIFYING_QUESTION"; payload: { id: string; answer: string } }
  | { type: "SKIP_CLARIFICATION" }
  | { type: "START_ROUND_1" }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "ADD_MESSAGES"; payload: Message[] }
  | { type: "START_MODERATION" }
  | { type: "ENTER_AWAITING_ROUND2" }
  | { type: "START_ROUND_2" }
  | { type: "START_NEXT_ROUND"; payload: number }
  | { type: "CONTINUE_DEBATE"; payload?: { extraRounds?: number } }
  | { type: "START_SUMMARIZING"; payload: ModelId }
  | { type: "RESTORE_STATUS_AFTER_SUMMARIZE_FAIL" }
  | { type: "SET_SUMMARY"; payload: DebateSummary }
  | { type: "UPDATE_SETTINGS"; payload: Partial<DebateSettings> }
  | { type: "OPEN_DRAWER"; payload?: "history" | "settings" }
  | { type: "CLOSE_DRAWER" }
  | { type: "SET_DRAWER_TAB"; payload: "history" | "settings" }
  | { type: "OPEN_SUMMARY" }
  | { type: "CLOSE_SUMMARY" }
  | { type: "OPEN_CLARIFICATION" }
  | { type: "CLOSE_CLARIFICATION" }
  | { type: "SET_LOADING"; payload: { loading: boolean; model?: ModelId | null } }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "NEW_DEBATE" }
  | { type: "APPEND_MESSAGE_CHUNK"; payload: { id: string; chunk: string } }
  | { type: "SET_MESSAGE_DONE"; payload: { id: string } }
  | { type: "SET_AGREEMENT_SCORE"; payload: number }
  | { type: "REMOVE_EMPTY_STREAMING_FOR_ROUND"; payload: number }
  | { type: "RESTORE_STATUS_AFTER_MOD_FAILED" }
  | { type: "START_JUDGE" }
  | { type: "JUDGE_COMPLETE"; payload: JudgeVerdict }
  | { type: "JUDGE_CANCEL_LOADING" }
  | { type: "ATTACH_FILE"; payload: AttachedFile }
  | { type: "CLEAR_FILE" }
  | { type: "SET_INTER_ROUND_CONTEXT"; payload: string }
  | {
      type: "LOAD_SAVED_DEBATE";
      payload: {
        topic: string;
        messages: Message[];
        settings: DebateSettings;
        rounds: number;
        summary: DebateSummary | null;
      };
    };
