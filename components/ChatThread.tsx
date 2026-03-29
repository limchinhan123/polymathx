"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertCircle, X } from "lucide-react";
import { useDebate, selectRounds } from "@/lib/debate-store";
import MessageBubble from "./MessageBubble";
import ModeratorBubble from "./ModeratorBubble";
import RoundDivider from "./RoundDivider";
import TypingIndicator from "./TypingIndicator";
import { type Message } from "@/lib/types";

export default function ChatThread() {
  const { state, dispatch } = useDebate();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages / errors
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.isLoading, state.error]);

  const idleSuggestions = useMemo(() => pickRandomTopics(SUGGESTION_POOL, 3), [state.status]);

  if (state.status === "idle") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 chat-thread overflow-y-auto">
        <h2 className="text-xl font-semibold tracking-tight">
          <span className="text-[#EF9F27]">X</span>
          <span className="text-white">pand your perspective</span>
        </h2>
        <p className="text-sm text-[#666] leading-relaxed max-w-[280px]">
          Enter a topic below and watch Claude, GPT-4o, and Gemini debate it — moderated by DeepSeek.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-[280px] mt-2">
          {idleSuggestions.map((topic) => (
            <ExampleTopicChip key={topic} topic={topic} />
          ))}
        </div>
      </div>
    );
  }

  // Group messages: interleave round dividers and moderator bubbles
  const rounds = selectRounds(state.messages);
  const renderedItems = buildRenderList(state.messages, rounds);

  return (
    <div className="flex-1 overflow-y-auto chat-thread py-2" aria-live="polite" aria-label="Debate chat">
      {state.error && (
        <div
          role="alert"
          className="sticky top-0 z-10 mx-3 mb-2 flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-950/50 px-3 py-2.5 text-[12px] text-red-100/95 shadow-lg backdrop-blur-sm"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" aria-hidden />
          <p className="flex-1 leading-snug">{state.error}</p>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
            className="shrink-0 rounded-lg p-1 text-red-300/80 hover:bg-red-500/15 hover:text-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {renderedItems.map((item) => {
        if (item.type === "divider") {
          return <RoundDivider key={`divider-${item.round}`} round={item.round} />;
        }
        if (item.message.isModerator) {
          return <ModeratorBubble key={item.message.id} message={item.message} />;
        }
        return <MessageBubble key={item.message.id} message={item.message} />;
      })}

      {/* Typing indicator */}
      {state.isLoading && state.loadingModel && (
        <TypingIndicator model={state.loadingModel} />
      )}

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}

// ─── Helper: build a flat render list interleaving dividers ──────────────────

type RenderItem =
  | { type: "divider"; round: number }
  | { type: "message"; message: Message };

function buildRenderList(messages: Message[], rounds: number[]): RenderItem[] {
  const items: RenderItem[] = [];

  // Moderator messages (round 0) go before round 2 divider
  const roundMessages = (round: number) => messages.filter((m) => m.round === round && !m.isModerator);
  const moderatorMessages = messages.filter((m) => m.isModerator);

  rounds.forEach((round, idx) => {
    items.push({ type: "divider", round });
    roundMessages(round).forEach((m) => items.push({ type: "message", message: m }));

    // Insert moderator message between rounds
    if (idx < rounds.length - 1) {
      const mod = moderatorMessages[idx];
      if (mod) items.push({ type: "message", message: mod });
    }
  });

  // If there are moderator messages after the last round (pending next round)
  if (moderatorMessages.length > rounds.length - 1) {
    const trailingMods = moderatorMessages.slice(rounds.length - 1);
    trailingMods.forEach((m) => items.push({ type: "message", message: m }));
  }

  return items;
}

// ─── Suggestion pool (3 random picks each time you land on idle) ─────────────

const SUGGESTION_POOL = [
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

function pickRandomTopics(pool: string[], count: number): string[] {
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

function ExampleTopicChip({ topic }: { topic: string }) {
  const { startDebate } = useDebate();
  return (
    <button
      type="button"
      onClick={() => startDebate(topic)}
      className="text-left text-[11px] px-3 py-2.5 rounded-xl border border-[#2A2A2A] text-[#888]
                 hover:border-[#EF9F27]/40 hover:text-[#EF9F27] hover:bg-[#EF9F27]/5 transition-all w-full"
    >
      {topic}
    </button>
  );
}
