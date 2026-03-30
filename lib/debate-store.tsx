"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  type DebateState,
  type DebateAction,
  type DebateSettings,
  type Message,
  type DebateSummary,
  type ClarifyingQuestion,
  type ModelId,
  type JudgeVerdict,
  type AttachedFile,
  DEFAULT_SETTINGS,
} from "./types";
import { getOrCreateDeviceId } from "./device-id";
import {
  mapMessagesForConvex,
  mapMessagesFromConvex,
  mapSettingsForConvex,
  mapSettingsFromConvex,
  summaryToConvexString,
  summaryFromConvexString,
} from "./convex-debate-mappers";
import { clearIdleSuggestionsCache } from "./idle-suggestions";
import { streamDebate } from "./stream";
import { toOpenRouterModeratorModel, toOpenRouterSummarizerModel } from "./openrouter-models";

/** Shown in the clarification modal if /api/clarify fails — user must still pass through the step. */
const FALLBACK_CLARIFYING_QUESTIONS = [
  "What specific outcome are you trying to understand or decide?",
  "Are there constraints — time, resources, or context — that should shape the debate?",
  "What assumptions do you currently hold about this topic?",
] as const;

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: DebateState = {
  status: "idle",
  topic: "",
  messages: [],
  currentRound: 0,
  clarifyingQuestions: [],
  summary: null,
  settings: DEFAULT_SETTINGS,
  drawerOpen: false,
  drawerTab: "history",
  summaryOpen: false,
  clarificationOpen: false,
  isLoading: false,
  loadingModel: null,
  error: null,
  agreementScore: null,
  judgeVerdict: null,
  judgeLoading: false,
  attachedFile: null,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function debateReducer(state: DebateState, action: DebateAction): DebateState {
  switch (action.type) {
    case "SET_TOPIC":
      return { ...state, topic: action.payload, error: null };

    case "START_DEBATE":
      return {
        ...state,
        status: "clarifying",
        clarificationOpen: true,
        isLoading: true,
        loadingModel: "deepseek",
        error: null,
      };

    case "SET_CLARIFYING_QUESTIONS":
      return {
        ...state,
        clarifyingQuestions: action.payload,
        isLoading: false,
        loadingModel: null,
      };

    case "ANSWER_CLARIFYING_QUESTION":
      return {
        ...state,
        clarifyingQuestions: state.clarifyingQuestions.map((q) =>
          q.id === action.payload.id ? { ...q, answer: action.payload.answer } : q
        ),
      };

    case "SKIP_CLARIFICATION":
      return {
        ...state,
        status: "round1",
        clarificationOpen: false,
        currentRound: 1,
        isLoading: true,
        loadingModel: "claude",
      };

    case "START_ROUND_1":
      return {
        ...state,
        status: "round1",
        clarificationOpen: false,
        currentRound: 1,
        isLoading: true,
        loadingModel: "claude",
      };

    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };

    case "ADD_MESSAGES":
      return { ...state, messages: [...state.messages, ...action.payload] };

    case "APPEND_MESSAGE_CHUNK":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id
            ? { ...m, content: m.content + action.payload.chunk }
            : m
        ),
      };

    case "SET_MESSAGE_DONE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload.id ? { ...m, isStreaming: false } : m
        ),
      };

    case "SET_AGREEMENT_SCORE":
      return { ...state, agreementScore: action.payload };

    case "REMOVE_EMPTY_STREAMING_FOR_ROUND":
      return {
        ...state,
        messages: state.messages.filter(
          (m) =>
            !(
              m.round === action.payload &&
              !m.isModerator &&
              m.isStreaming &&
              m.content.trim() === ""
            )
        ),
      };

    case "RESTORE_STATUS_AFTER_MOD_FAILED":
      if (state.status !== "moderating") return state;
      return {
        ...state,
        status: state.currentRound >= 2 ? "round2" : "round1",
        isLoading: false,
        loadingModel: null,
      };

    case "START_MODERATION":
      return {
        ...state,
        status: "moderating",
        isLoading: true,
        loadingModel: "deepseek",
      };

    case "START_ROUND_2":
      return {
        ...state,
        status: "round2",
        currentRound: 2,
        isLoading: true,
        loadingModel: "claude",
      };

    case "START_NEXT_ROUND":
      return {
        ...state,
        status: "round2",
        currentRound: action.payload,
        isLoading: true,
        loadingModel: "claude",
      };

    case "CONTINUE_DEBATE":
      return {
        ...state,
        status: "moderating",
        isLoading: true,
        loadingModel: "deepseek",
        error: null,
      };

    case "START_SUMMARIZING":
      return {
        ...state,
        status: "summarizing",
        isLoading: true,
        loadingModel: "claude",
        error: null,
      };

    case "SET_SUMMARY":
      return {
        ...state,
        summary: action.payload,
        status: "complete",
        isLoading: false,
        loadingModel: null,
        summaryOpen: true,
        judgeVerdict: null,
        judgeLoading: false,
      };

    case "UPDATE_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, ...action.payload },
      };

    case "OPEN_DRAWER":
      return {
        ...state,
        drawerOpen: true,
        drawerTab: action.payload ?? state.drawerTab,
      };

    case "CLOSE_DRAWER":
      return { ...state, drawerOpen: false };

    case "SET_DRAWER_TAB":
      return { ...state, drawerTab: action.payload };

    case "OPEN_SUMMARY":
      return { ...state, summaryOpen: true };

    case "CLOSE_SUMMARY":
      return { ...state, summaryOpen: false };

    case "OPEN_CLARIFICATION":
      return { ...state, clarificationOpen: true };

    case "CLOSE_CLARIFICATION":
      return { ...state, clarificationOpen: false };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload.loading,
        loadingModel: action.payload.model ?? null,
      };

    case "SET_ERROR":
      if (action.payload === null) {
        return { ...state, error: null };
      }
      return { ...state, error: action.payload, isLoading: false, loadingModel: null };

    case "NEW_DEBATE":
      return {
        ...initialState,
        settings: state.settings,
        attachedFile: null,
      };

    case "START_JUDGE":
      return { ...state, judgeLoading: true, error: null };

    case "JUDGE_COMPLETE":
      return { ...state, judgeLoading: false, judgeVerdict: action.payload };

    case "JUDGE_CANCEL_LOADING":
      return { ...state, judgeLoading: false };

    case "ATTACH_FILE":
      return { ...state, attachedFile: action.payload };

    case "CLEAR_FILE":
      return { ...state, attachedFile: null };

    case "LOAD_SAVED_DEBATE": {
      const p = action.payload;
      return {
        ...initialState,
        settings: p.settings,
        topic: p.topic,
        messages: p.messages,
        currentRound: p.rounds,
        clarifyingQuestions: [],
        summary: p.summary,
        status: p.summary ? "complete" : p.rounds >= 2 ? "round2" : "round1",
        drawerOpen: false,
        summaryOpen: false,
        clarificationOpen: false,
        isLoading: false,
        loadingModel: null,
        error: null,
        agreementScore: null,
        judgeVerdict: null,
        judgeLoading: false,
      };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface DebateContextValue {
  state: DebateState;
  dispatch: React.Dispatch<DebateAction>;
  startDebate: (topic: string) => Promise<void>;
  skipClarification: () => Promise<void>;
  submitClarification: () => Promise<void>;
  startRound2: () => Promise<void>;
  continueDebate: () => Promise<void>;
  triggerSummarize: () => Promise<void>;
  newDebate: () => void;
  loadSavedDebate: (record: Doc<"debates">) => void;
  updateSettings: (settings: Partial<DebateSettings>) => void;
  triggerJudge: () => Promise<void>;
}

const DebateContext = createContext<DebateContextValue | null>(null);

function makeId() {
  return crypto.randomUUID();
}

function clarifyingQuestionsFromStrings(questions: readonly string[]): ClarifyingQuestion[] {
  return questions.map((q) => ({
    id: makeId(),
    question: q,
    answer: "",
  }));
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function DebateProvider({ children }: { children: ReactNode }) {
  const saveDebate = useMutation(api.debates.saveDebate);
  const [state, dispatch] = useReducer(debateReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const startDebate = useCallback(async (topic: string) => {
    dispatch({ type: "SET_TOPIC", payload: topic });
    dispatch({ type: "START_DEBATE" });

    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) {
        console.error("clarify HTTP", res.status);
        dispatch({
          type: "SET_CLARIFYING_QUESTIONS",
          payload: clarifyingQuestionsFromStrings(FALLBACK_CLARIFYING_QUESTIONS),
        });
        return;
      }
      const data = (await res.json()) as { questions: string[] };
      const qs = Array.isArray(data.questions) ? data.questions : [];
      const questions: ClarifyingQuestion[] =
        qs.length >= 3
          ? clarifyingQuestionsFromStrings([String(qs[0]), String(qs[1]), String(qs[2])])
          : clarifyingQuestionsFromStrings(FALLBACK_CLARIFYING_QUESTIONS);
      dispatch({ type: "SET_CLARIFYING_QUESTIONS", payload: questions });
    } catch (err) {
      console.error(err);
      dispatch({
        type: "SET_CLARIFYING_QUESTIONS",
        payload: clarifyingQuestionsFromStrings(FALLBACK_CLARIFYING_QUESTIONS),
      });
    }
  }, []);

  const runRound = useCallback(async (round: number, moderatorQuestion?: string) => {
    try {
      const s = stateRef.current;
      const bh = s.settings.blackHatMode;

      const claudeId = makeId();
      const gpt4oId = makeId();
      const geminiId = makeId();
      const grokId = bh ? makeId() : null;

      const placeholders: Message[] = [
        {
          id: claudeId,
          model: "claude",
          role: "model",
          personaTag: s.settings.claudePersona,
          content: "",
          round,
          timestamp: Date.now(),
          isModerator: false,
          isStreaming: true,
        },
        {
          id: gpt4oId,
          model: "gpt4o",
          role: "model",
          personaTag: s.settings.gptPersona,
          content: "",
          round,
          timestamp: Date.now() + 1,
          isModerator: false,
          isStreaming: true,
        },
        {
          id: geminiId,
          model: "gemini",
          role: "model",
          personaTag: s.settings.geminiPersona,
          content: "",
          round,
          timestamp: Date.now() + 2,
          isModerator: false,
          isStreaming: true,
        },
        ...(bh && grokId
          ? [
              {
                id: grokId,
                model: "grok" as const,
                role: "model" as const,
                personaTag: "Black Hat",
                content: "",
                round,
                timestamp: Date.now() + 3,
                isModerator: false,
                isStreaming: true,
                blackHat: true,
              } satisfies Message,
            ]
          : []),
      ];

      dispatch({ type: "ADD_MESSAGES", payload: placeholders });
      dispatch({ type: "SET_LOADING", payload: { loading: false } });

      const modelToId: Record<string, string> = {
        claude: claudeId,
        gpt4o: gpt4oId,
        gemini: geminiId,
        ...(grokId ? { grok: grokId } : {}),
      };

      const prevMessages = s.messages.filter((m) => m.round === round - 1 && !m.isModerator);
      const round1Messages = s.messages.filter((m) => m.round === 1 && !m.isModerator);

      const previousResponses =
        round >= 2
          ? {
              claude: prevMessages.find((m) => m.model === "claude")?.content ?? "",
              gpt: prevMessages.find((m) => m.model === "gpt4o")?.content ?? "",
              gemini: prevMessages.find((m) => m.model === "gemini")?.content ?? "",
              ...(bh
                ? { grok: prevMessages.find((m) => m.model === "grok")?.content ?? "" }
                : {}),
            }
          : undefined;

      const round1ByModel =
        round >= 2
          ? {
              claude: round1Messages.find((m) => m.model === "claude")?.content ?? "",
              gpt: round1Messages.find((m) => m.model === "gpt4o")?.content ?? "",
              gemini: round1Messages.find((m) => m.model === "gemini")?.content ?? "",
              ...(bh
                ? { grok: round1Messages.find((m) => m.model === "grok")?.content ?? "" }
                : {}),
            }
          : undefined;

      const payload = {
        topic: s.topic,
        round,
        clarifications: s.clarifyingQuestions
          .filter((q) => q.answer.trim())
          .map((q) => `${q.question}: ${q.answer}`),
        settings: {
          claudeModel: s.settings.claudeModel,
          gptModel: s.settings.gptModel,
          geminiModel: s.settings.geminiModel,
          temperature: s.settings.temperature,
          debateStyle: s.settings.debateStyle,
          blackHatMode: s.settings.blackHatMode,
          personas: {
            claude: s.settings.claudePersona,
            gpt: s.settings.gptPersona,
            gemini: s.settings.geminiPersona,
          },
        },
        ...(previousResponses ? { previousResponses } : {}),
        ...(round1ByModel ? { round1ByModel } : {}),
        ...(moderatorQuestion ? { moderatorQuestion } : {}),
        ...(s.attachedFile ? { attachedFile: s.attachedFile } : {}),
      };

      await streamDebate(
        payload,
        (model, chunk) => {
          const id = modelToId[model];
          if (id) dispatch({ type: "APPEND_MESSAGE_CHUNK", payload: { id, chunk } });
        },
        (model) => {
          const id = modelToId[model];
          if (id) dispatch({ type: "SET_MESSAGE_DONE", payload: { id } });
        }
      );
    } catch (err) {
      dispatch({ type: "REMOVE_EMPTY_STREAMING_FOR_ROUND", payload: round });
      dispatch({
        type: "SET_ERROR",
        payload: "Could not load model responses. Check your connection and API keys, then try again.",
      });
      console.error(err);
    }
  }, []);

  const skipClarification = useCallback(async () => {
    dispatch({ type: "SKIP_CLARIFICATION" });
    await runRound(1);
  }, [runRound]);

  const submitClarification = useCallback(async () => {
    dispatch({ type: "START_ROUND_1" });
    await runRound(1);
  }, [runRound]);

  /** Returns moderator follow-up for round 2; `ok: false` if the API call failed. */
  const runModeration = useCallback(async (): Promise<{ ok: boolean; nextQuestion: string }> => {
    dispatch({ type: "START_MODERATION" });
    try {
      const s = stateRef.current;

      // Collect latest debater round (avoid Math.max() on empty spread)
      const debaterRounds = s.messages.filter((m) => !m.isModerator).map((m) => m.round);
      const latestRound =
        debaterRounds.length > 0 ? Math.max(...debaterRounds) : 1;
      const roundMsgs = s.messages.filter((m) => m.round === latestRound && !m.isModerator);

      const res = await fetch("/api/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: s.topic,
          model: toOpenRouterModeratorModel(s.settings.moderatorModel),
          responses: {
            claude: roundMsgs.find((m) => m.model === "claude")?.content ?? "",
            gpt: roundMsgs.find((m) => m.model === "gpt4o")?.content ?? "",
            gemini: roundMsgs.find((m) => m.model === "gemini")?.content ?? "",
            ...(s.settings.blackHatMode
              ? { grok: roundMsgs.find((m) => m.model === "grok")?.content ?? "" }
              : {}),
          },
        }),
      });
      if (!res.ok) throw new Error(`moderate ${res.status}`);

      const data = (await res.json()) as {
        tension: string;
        agreementScore: number;
        nextQuestion: string;
      };

      const moderatorMsg: Message = {
        id: makeId(),
        model: "deepseek",
        role: "moderator",
        personaTag: "Moderator",
        content: data.tension,
        round: 0,
        timestamp: Date.now(),
        isModerator: true,
        agreementScore: data.agreementScore,
        nextQuestion: data.nextQuestion,
      };

      dispatch({ type: "ADD_MESSAGE", payload: moderatorMsg });
      dispatch({ type: "SET_AGREEMENT_SCORE", payload: data.agreementScore });
      dispatch({ type: "SET_LOADING", payload: { loading: false } });

      return { ok: true, nextQuestion: data.nextQuestion };
    } catch (err) {
      dispatch({ type: "RESTORE_STATUS_AFTER_MOD_FAILED" });
      dispatch({
        type: "SET_ERROR",
        payload: "Moderation failed. You can still read the debate or try Round 2 again.",
      });
      console.error(err);
      return { ok: false, nextQuestion: "" };
    }
  }, []);

  const startRound2 = useCallback(async () => {
    const { ok, nextQuestion } = await runModeration();
    if (!ok) return;
    dispatch({ type: "START_ROUND_2" });
    await runRound(2, nextQuestion);
  }, [runModeration, runRound]);

  const continueDebate = useCallback(async () => {
    const nextRound = stateRef.current.currentRound + 1;
    dispatch({ type: "CONTINUE_DEBATE" });
    const { ok, nextQuestion } = await runModeration();
    if (!ok) return;
    dispatch({ type: "START_NEXT_ROUND", payload: nextRound });
    await runRound(nextRound, nextQuestion);
  }, [runModeration, runRound]);

  const triggerSummarize = useCallback(async () => {
    dispatch({ type: "START_SUMMARIZING" });
    try {
      const s = stateRef.current;

      const allMessages = s.messages
        .filter((m) => !m.isModerator && m.content.trim())
        .map((m) => ({ model: m.model, content: m.content, round: m.round }));

      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: s.topic,
          allMessages,
          model: toOpenRouterSummarizerModel(s.settings.summarizerModel),
        }),
      });
      if (!res.ok) throw new Error(`summarize ${res.status}`);
      const data = (await res.json()) as DebateSummary;

      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        try {
          await saveDebate({
            deviceId,
            topic: s.topic,
            messages: mapMessagesForConvex(s.messages),
            settings: mapSettingsForConvex(s.settings),
            rounds: s.currentRound,
            summary: summaryToConvexString(data),
            createdAt: new Date().toISOString(),
          });
        } catch (persistErr) {
          console.error("Failed to save debate to Convex:", persistErr);
        }
      }

      dispatch({ type: "SET_SUMMARY", payload: data });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: "Summary could not be generated. Check your connection and try again.",
      });
      console.error(err);
    }
  }, [saveDebate]);

  const triggerJudge = useCallback(async () => {
    dispatch({ type: "START_JUDGE" });
    try {
      const s = stateRef.current;
      if (!s.summary) {
        dispatch({ type: "JUDGE_CANCEL_LOADING" });
        return;
      }
      const allMessages = s.messages
        .filter((m) => !m.isModerator && m.content.trim())
        .map((m) => ({ model: m.model, content: m.content, round: m.round }));

      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: s.topic,
          allMessages,
          summary: s.summary,
        }),
      });
      if (!res.ok) throw new Error(`judge ${res.status}`);
      const data = (await res.json()) as JudgeVerdict;
      dispatch({ type: "JUDGE_COMPLETE", payload: data });
    } catch (err) {
      dispatch({ type: "JUDGE_CANCEL_LOADING" });
      dispatch({
        type: "SET_ERROR",
        payload: "Could not load the judge verdict. Check your connection and try again.",
      });
      console.error(err);
    }
  }, []);

  const newDebate = useCallback(() => {
    clearIdleSuggestionsCache();
    dispatch({ type: "NEW_DEBATE" });
  }, []);

  const loadSavedDebate = useCallback((record: Doc<"debates">) => {
    dispatch({
      type: "LOAD_SAVED_DEBATE",
      payload: {
        topic: record.topic,
        messages: mapMessagesFromConvex(record.messages),
        settings: mapSettingsFromConvex(record.settings),
        rounds: record.rounds,
        summary: summaryFromConvexString(record.summary),
      },
    });
    dispatch({ type: "CLOSE_DRAWER" });
  }, []);

  const updateSettings = useCallback((settings: Partial<DebateSettings>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings });
  }, []);

  const value: DebateContextValue = {
    state,
    dispatch,
    startDebate,
    skipClarification,
    submitClarification,
    startRound2,
    continueDebate,
    triggerSummarize,
    newDebate,
    loadSavedDebate,
    updateSettings,
    triggerJudge,
  };

  return <DebateContext.Provider value={value}>{children}</DebateContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDebate(): DebateContextValue {
  const ctx = useContext(DebateContext);
  if (!ctx) {
    throw new Error("useDebate must be used inside <DebateProvider>");
  }
  return ctx;
}

// ─── Derived selectors ────────────────────────────────────────────────────────

export function selectDebaterMessages(messages: Message[]): Message[] {
  return messages.filter((m) => !m.isModerator);
}

export function selectModeratorMessages(messages: Message[]): Message[] {
  return messages.filter((m) => m.isModerator);
}

export function selectMessagesByRound(messages: Message[], round: number): Message[] {
  return messages.filter((m) => m.round === round);
}

export function selectRounds(messages: Message[]): number[] {
  const rounds = new Set(messages.map((m) => m.round).filter((r) => r > 0));
  return Array.from(rounds).sort((a, b) => a - b);
}

export function getModelColor(model: ModelId): string {
  const colors: Record<ModelId, string> = {
    claude: "#8B7CF6",
    gpt4o: "#10A37F",
    gemini: "#4285F4",
    deepseek: "#EF9F27",
    grok: "#06B6D4",
  };
  return colors[model];
}

export function getModelInitial(model: ModelId): string {
  const initials: Record<ModelId, string> = {
    claude: "C",
    gpt4o: "G",
    gemini: "Gm",
    deepseek: "DS",
    grok: "R1",
  };
  return initials[model];
}
