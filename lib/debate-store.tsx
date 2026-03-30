"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
  isBlackHatDebaterModel,
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
import { streamDebate, type DebatePayload } from "./stream";
import {
  summarizerTypingModel,
  toOpenRouterModeratorModel,
  toOpenRouterSummarizerModel,
} from "./openrouter-models";

/** Shown in the clarification modal if /api/clarify fails — user must still pass through the step. */
const FALLBACK_CLARIFYING_QUESTIONS = [
  "What specific outcome are you trying to understand or decide?",
  "Are there constraints — time, resources, or context — that should shape the debate?",
  "What assumptions do you currently hold about this topic?",
] as const;

// ─── Session persistence (app switch / reload) ────────────────────────────────

const SESSION_KEY = "polymath_active_debate";

/** Set by `buildInitialState` when session restore ran (optional diagnostics). */
export let sessionRestoredTopicMarker: string | null = null;

function defaultDebateState(): DebateState {
  return {
    status: "idle",
    topic: "",
    messages: [],
    currentRound: 0,
    pendingRound: 0,
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
    interRoundContext: "",
    convexDebateId: null,
    toast: null,
  };
}

function saveToSession(state: DebateState): void {
  try {
    // Never persist `complete` without a full summary payload (old bug re-saved after SET_SUMMARY).
    // Clear so reload does not restore a bogus `complete` row or stale pre-summary snapshot.
    if (state.status === "complete") {
      clearSessionStorageKey();
      return;
    }

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        topic: state.topic,
        messages: state.messages,
        currentRound: state.currentRound,
        pendingRound: state.pendingRound,
        status: state.status,
        settings: state.settings,
        interRoundContext: state.interRoundContext,
        convexDebateId: state.convexDebateId,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* quota / private mode */
  }
}

function loadSessionPartial(): Partial<DebateState> & { savedAt?: string } | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Record<string, unknown>;
    const savedAt = new Date(String(parsed.savedAt ?? ""));
    if (Number.isNaN(savedAt.getTime())) return null;
    const diffHours = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
    if (diffHours > 2) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed as Partial<DebateState> & { savedAt: string };
  } catch {
    return null;
  }
}

/** Topic from session backup if entry exists and is within TTL — for restore toast on `page.tsx` mount. */
export function readFreshSessionDebateTopic(): string | null {
  const snap = loadSessionPartial();
  if (!snap || typeof snap.topic !== "string" || !snap.topic.trim()) return null;
  return snap.topic;
}

function buildInitialState(): DebateState {
  const base = defaultDebateState();
  const snap = loadSessionPartial();
  if (!snap || typeof snap.topic !== "string") {
    sessionRestoredTopicMarker = null;
    return base;
  }
  sessionRestoredTopicMarker = snap.topic;
  const messages = Array.isArray(snap.messages)
    ? (snap.messages as Message[]).map((m) => ({ ...m, isStreaming: false as const }))
    : [];
  const currentRound = typeof snap.currentRound === "number" ? snap.currentRound : 0;
  const rawStatus =
    typeof (snap as { status?: unknown }).status === "string"
      ? String((snap as { status?: string }).status)
      : "idle";
  let restoredStatus: DebateState["status"] =
    rawStatus === "awaiting_next_round" || rawStatus === "awaiting_round2"
      ? "pending_round"
      : (rawStatus as DebateState["status"]) ?? "idle";

  let restoredPending =
    typeof (snap as { pendingRound?: unknown }).pendingRound === "number"
      ? (snap as { pendingRound: number }).pendingRound
      : 0;

  // Legacy session rows: `complete` was saved without summary → normalize so Round 2 stays reachable.
  if (restoredStatus === "complete") {
    const hasModerator = messages.some((m) => m.isModerator);
    if (currentRound >= 1 && hasModerator) {
      restoredStatus = "pending_round";
      restoredPending = currentRound + 1;
    } else if (currentRound >= 1) {
      restoredStatus = "round1";
      restoredPending = 0;
    } else {
      restoredStatus = "idle";
      restoredPending = 0;
    }
  }

  if (restoredStatus === "pending_round" && restoredPending < 1) {
    restoredPending = Math.max(1, currentRound + 1);
  }
  if (restoredStatus !== "pending_round") {
    restoredPending = 0;
  }

  return {
    ...base,
    topic: snap.topic,
    messages,
    currentRound,
    pendingRound: restoredPending,
    status: restoredStatus,
    settings: { ...DEFAULT_SETTINGS, ...(snap.settings as DebateSettings) },
    interRoundContext: typeof snap.interRoundContext === "string" ? snap.interRoundContext : "",
    convexDebateId: typeof snap.convexDebateId === "string" ? snap.convexDebateId : null,
  };
}

const initialState = buildInitialState();

function clearSessionStorageKey(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function debateReducerInner(state: DebateState, action: DebateAction): DebateState {
  switch (action.type) {
    case "SET_TOPIC":
      return { ...state, topic: action.payload, error: null };

    case "START_DEBATE":
      clearSessionStorageKey();
      return {
        ...state,
        status: "clarifying",
        pendingRound: 0,
        clarificationOpen: true,
        isLoading: true,
        loadingModel: "deepseek",
        error: null,
        convexDebateId: null,
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
        pendingRound: 0,
        clarificationOpen: false,
        currentRound: 1,
        isLoading: true,
        loadingModel: "claude",
      };

    case "START_ROUND_1":
      return {
        ...state,
        status: "round1",
        pendingRound: 0,
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
        status: state.currentRound >= 2 ? "debating" : "round1",
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

    case "ENTER_PENDING_ROUND":
      return {
        ...state,
        status: "pending_round",
        pendingRound: action.payload,
        isLoading: false,
        loadingModel: null,
      };

    case "START_NEXT_ROUND":
      return {
        ...state,
        status: "debating",
        currentRound: action.payload,
        pendingRound: 0,
        isLoading: true,
        loadingModel: "claude",
      };

    case "ROUND_STREAM_TIMEOUT": {
      const r = action.payload;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.round === r && !m.isModerator ? { ...m, isStreaming: false } : m
        ),
        status: "pending_round",
        pendingRound: r + 1,
        isLoading: false,
        loadingModel: null,
        toast: "Response timed out — continuing with available responses",
      };
    }

    case "SET_TOAST":
      return { ...state, toast: action.payload };

    case "SET_CONVEX_ID":
      return { ...state, convexDebateId: action.payload };

    case "START_SUMMARIZING":
      return {
        ...state,
        status: "summarizing",
        isLoading: true,
        loadingModel: action.payload,
        error: null,
      };

    case "RESTORE_STATUS_AFTER_SUMMARIZE_FAIL":
      if (state.status !== "summarizing") return state;
      {
        let nextStatus: DebateState["status"] = "round1";
        if (state.currentRound >= 2) {
          nextStatus = "debating";
        } else if (
          state.messages.some(
            (m) => m.isModerator && (m.nextQuestion !== undefined || m.agreementScore != null)
          )
        ) {
          nextStatus = "pending_round";
        }
        const nextPending =
          nextStatus === "pending_round" ? state.currentRound + 1 : 0;
        return {
          ...state,
          status: nextStatus,
          pendingRound: nextPending,
          isLoading: false,
          loadingModel: null,
        };
      }

    case "SET_SUMMARY":
      clearSessionStorageKey();
      return {
        ...state,
        summary: action.payload,
        status: "complete",
        pendingRound: 0,
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
      clearSessionStorageKey();
      return {
        ...defaultDebateState(),
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

    case "SET_INTER_ROUND_CONTEXT":
      return { ...state, interRoundContext: action.payload };

    case "LOAD_SAVED_DEBATE": {
      const p = action.payload;
      const fresh = defaultDebateState();
      let nextStatus: DebateState["status"] = "round1";
      if (p.summary) nextStatus = "complete";
      else if (p.rounds >= 1) nextStatus = "pending_round";
      const loadedPending = nextStatus === "pending_round" ? p.rounds + 1 : 0;
      return {
        ...fresh,
        settings: p.settings,
        topic: p.topic,
        messages: p.messages,
        currentRound: p.rounds,
        pendingRound: loadedPending,
        clarifyingQuestions: [],
        summary: p.summary,
        status: nextStatus,
        drawerOpen: false,
        summaryOpen: false,
        clarificationOpen: false,
        isLoading: false,
        loadingModel: null,
        error: null,
        agreementScore: null,
        judgeVerdict: null,
        judgeLoading: false,
        convexDebateId: null,
        toast: null,
      };
    }

    default:
      return state;
  }
}

function debateReducer(state: DebateState, action: DebateAction): DebateState {
  const next = debateReducerInner(state, action);
  if (next.status !== state.status) {
    console.log("Status transition:", state.status, "→", next.status, `(action: ${action.type})`);
  }
  return next;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface DebateContextValue {
  state: DebateState;
  dispatch: React.Dispatch<DebateAction>;
  startDebate: (topic: string) => Promise<void>;
  skipClarification: () => Promise<void>;
  submitClarification: () => Promise<void>;
  /** Run moderator only; then status becomes `pending_round` so the user can add context. */
  prepareForRound2: () => Promise<void>;
  /** Start the next debater round (after `pending_round`). */
  startRound2: () => Promise<void>;
  /** @deprecated Same as prepareForRound2 — perpetual flow always moderates before the next round. */
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
  const updateDebate = useMutation(api.debates.updateDebate);
  const [state, dispatch] = useReducer(debateReducer, initialState);

  const ensureInProgressConvexDoc = useCallback(async () => {
    const s = stateRef.current;
    if (s.convexDebateId) return;
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) return;
    try {
      const id = await saveDebate({
        deviceId,
        topic: s.topic,
        messages: [],
        settings: mapSettingsForConvex(s.settings),
        rounds: 0,
        createdAt: new Date().toISOString(),
        status: "in_progress",
      });
      dispatch({ type: "SET_CONVEX_ID", payload: id });
    } catch (e) {
      console.error("saveDebate (debate start):", e);
    }
  }, [saveDebate]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    saveToSession(state);
  }, [state]);

  useEffect(() => {
    if (!state.toast) return;
    const t = window.setTimeout(() => dispatch({ type: "SET_TOAST", payload: null }), 4500);
    return () => window.clearTimeout(t);
  }, [state.toast]);

  const roundWatchRef = useRef<{
    round: number;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);

  useEffect(() => {
    const { status, currentRound, messages } = state;
    if (status !== "round1" && status !== "debating") {
      if (roundWatchRef.current) {
        clearTimeout(roundWatchRef.current.timeoutId);
        roundWatchRef.current = null;
      }
      return;
    }
    if (roundWatchRef.current && roundWatchRef.current.round !== currentRound) {
      clearTimeout(roundWatchRef.current.timeoutId);
      roundWatchRef.current = null;
    }
    const hasStreaming = messages.some(
      (m) => !m.isModerator && m.round === currentRound && m.isStreaming
    );
    if (!hasStreaming) {
      if (roundWatchRef.current?.round === currentRound) {
        clearTimeout(roundWatchRef.current.timeoutId);
        roundWatchRef.current = null;
      }
      return;
    }
    if (roundWatchRef.current?.round === currentRound) return;
    const timeoutId = setTimeout(() => {
      const s = stateRef.current;
      if (
        (s.status !== "round1" && s.status !== "debating") ||
        s.currentRound !== currentRound
      ) {
        return;
      }
      const stillStreaming = s.messages.some(
        (m) => !m.isModerator && m.round === currentRound && m.isStreaming
      );
      if (!stillStreaming) return;
      dispatch({ type: "ROUND_STREAM_TIMEOUT", payload: currentRound });
      roundWatchRef.current = null;
    }, 60_000);
    roundWatchRef.current = { round: currentRound, timeoutId };
  }, [state]);

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

  const runRound = useCallback(
    async (round: number, moderatorQuestion?: string) => {
      try {
        const s = stateRef.current;
        const bh = s.settings.blackHatMode;

        const claudeId = makeId();
        const gpt4oId = makeId();
        const geminiId = makeId();
        const blackHatId = bh ? makeId() : null;

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
          ...(bh && blackHatId
            ? [
                {
                  id: blackHatId,
                  model: "blackHat" as const,
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
          ...(blackHatId ? { blackHat: blackHatId, grok: blackHatId } : {}),
        };

        const prevRound = round - 1;
        const prevMessages = s.messages.filter((m) => m.round === prevRound && !m.isModerator);

        const previousResponses =
          round >= 2
            ? {
                claude: prevMessages.find((m) => m.model === "claude")?.content ?? "",
                gpt: prevMessages.find((m) => m.model === "gpt4o")?.content ?? "",
                gemini: prevMessages.find((m) => m.model === "gemini")?.content ?? "",
                ...(bh
                  ? {
                      blackHat:
                        prevMessages.find((m) => isBlackHatDebaterModel(String(m.model)))?.content ?? "",
                    }
                  : {}),
              }
            : undefined;

        const ownPreviousResponse =
          round >= 2
            ? {
                claude: prevMessages.find((m) => m.model === "claude")?.content ?? "",
                gpt: prevMessages.find((m) => m.model === "gpt4o")?.content ?? "",
                gemini: prevMessages.find((m) => m.model === "gemini")?.content ?? "",
                ...(bh
                  ? {
                      blackHat:
                        prevMessages.find((m) => isBlackHatDebaterModel(String(m.model)))?.content ?? "",
                    }
                  : {}),
              }
            : undefined;

        const interRoundTrimmed = round >= 2 ? s.interRoundContext.trim() : "";

        const payload = {
          topic: s.topic,
          round,
          pendingRound: round,
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
          ...(ownPreviousResponse ? { ownPreviousResponse } : {}),
          ...(moderatorQuestion ? { moderatorQuestion } : {}),
          ...(s.attachedFile ? { attachedFile: s.attachedFile } : {}),
          ...(interRoundTrimmed ? { interRoundContext: interRoundTrimmed } : {}),
        };

        if (round >= 2) {
          dispatch({ type: "SET_INTER_ROUND_CONTEXT", payload: "" });
        }

        await streamDebate(
          payload as DebatePayload,
          (model, chunk) => {
            const id = modelToId[model];
            if (id) dispatch({ type: "APPEND_MESSAGE_CHUNK", payload: { id, chunk } });
          },
          (model) => {
            const id = modelToId[model];
            if (id) dispatch({ type: "SET_MESSAGE_DONE", payload: { id } });
          }
        );

        await new Promise((r) => setTimeout(r, 0));
        const snap = stateRef.current;
        if (snap.convexDebateId) {
          try {
            await updateDebate({
              id: snap.convexDebateId as Id<"debates">,
              messages: mapMessagesForConvex(snap.messages),
              rounds: round,
              status: "in_progress",
            });
          } catch (persistErr) {
            console.error("updateDebate after round failed:", persistErr);
          }
        }
      } catch (err) {
        dispatch({ type: "REMOVE_EMPTY_STREAMING_FOR_ROUND", payload: round });
        dispatch({
          type: "SET_ERROR",
          payload: "Could not load model responses. Check your connection and API keys, then try again.",
        });
        console.error(err);
      }
    },
    [updateDebate]
  );

  const skipClarification = useCallback(async () => {
    dispatch({ type: "SKIP_CLARIFICATION" });
    await ensureInProgressConvexDoc();
    await runRound(1);
  }, [runRound, ensureInProgressConvexDoc]);

  const submitClarification = useCallback(async () => {
    dispatch({ type: "START_ROUND_1" });
    await ensureInProgressConvexDoc();
    await runRound(1);
  }, [runRound, ensureInProgressConvexDoc]);

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
              ? {
                  blackHat:
                    roundMsgs.find((m) => isBlackHatDebaterModel(String(m.model)))?.content ?? "",
                }
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

  const prepareForRound2 = useCallback(async () => {
    const { ok } = await runModeration();
    if (!ok) return;
    const cr = stateRef.current.currentRound;
    dispatch({ type: "ENTER_PENDING_ROUND", payload: cr + 1 });
  }, [runModeration]);

  const startRound2 = useCallback(async () => {
    const s = stateRef.current;
    const nextRound =
      s.pendingRound > 0 ? s.pendingRound : s.currentRound + 1;
    const nextQuestion =
      [...s.messages].reverse().find((m) => m.isModerator)?.nextQuestion ?? "";
    dispatch({ type: "START_NEXT_ROUND", payload: nextRound });
    await runRound(nextRound, nextQuestion);
  }, [runRound]);

  const continueDebate = useCallback(async () => {
    await prepareForRound2();
  }, [prepareForRound2]);

  const triggerSummarize = useCallback(async () => {
    const s = stateRef.current;
    dispatch({
      type: "START_SUMMARIZING",
      payload: summarizerTypingModel(s.settings.summarizerModel),
    });
    const SUMMARIZE_CLIENT_TIMEOUT_MS = 135_000;
    const ac = new AbortController();
    const clientTimeout = setTimeout(() => ac.abort(), SUMMARIZE_CLIENT_TIMEOUT_MS);

    try {
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
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`summarize ${res.status}`);
      const data = (await res.json()) as DebateSummary;

      const deviceId = getOrCreateDeviceId();
      const snap = stateRef.current;
      if (deviceId) {
        try {
          if (snap.convexDebateId) {
            await updateDebate({
              id: snap.convexDebateId as Id<"debates">,
              summary: summaryToConvexString(data),
              status: "complete",
              rounds: snap.currentRound,
              messages: mapMessagesForConvex(snap.messages),
            });
          } else {
            await saveDebate({
              deviceId,
              topic: snap.topic,
              messages: mapMessagesForConvex(snap.messages),
              settings: mapSettingsForConvex(snap.settings),
              rounds: snap.currentRound,
              summary: summaryToConvexString(data),
              createdAt: new Date().toISOString(),
              status: "complete",
            });
          }
        } catch (persistErr) {
          console.error("Failed to persist debate to Convex:", persistErr);
        }
      }

      dispatch({ type: "SET_SUMMARY", payload: data });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload:
          err instanceof Error && err.name === "AbortError"
            ? "Summary timed out. Try again, or switch Summarizer to Gemini in Settings."
            : "Summary could not be generated. Check your connection and try again.",
      });
      dispatch({ type: "RESTORE_STATUS_AFTER_SUMMARIZE_FAIL" });
      console.error(err);
    } finally {
      clearTimeout(clientTimeout);
    }
  }, [saveDebate, updateDebate]);

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
    prepareForRound2,
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
    blackHat: "#06B6D4",
  };
  return colors[model];
}

export function getModelInitial(model: ModelId): string {
  const initials: Record<ModelId, string> = {
    claude: "C",
    gpt4o: "G",
    gemini: "Gm",
    deepseek: "DS",
    blackHat: "R1",
  };
  return initials[model];
}
