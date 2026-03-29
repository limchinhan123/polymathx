"use client";

import { useEffect, useRef } from "react";
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

  if (state.status === "idle") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 chat-thread overflow-y-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-[#2A2A2A] flex items-center justify-center mb-2">
          <span className="text-2xl font-bold text-[#EF9F27]">X</span>
        </div>
        <h2 className="text-xl font-semibold text-white">Start a debate</h2>
        <p className="text-sm text-[#666] leading-relaxed max-w-[280px]">
          Enter a topic below and watch Claude, GPT-4o, and Gemini debate it — moderated by DeepSeek.
        </p>
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {EXAMPLE_TOPICS.map((topic) => (
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

// ─── Example topics ───────────────────────────────────────────────────────────

const EXAMPLE_TOPICS = [
  "Is AGI inevitable by 2030?",
  "Should AI have legal personhood?",
  "Is remote work better than office?",
];

function ExampleTopicChip({ topic }: { topic: string }) {
  const { startDebate } = useDebate();
  return (
    <button
      onClick={() => startDebate(topic)}
      className="text-[11px] px-3 py-1.5 rounded-full border border-[#2A2A2A] text-[#888]
                 hover:border-[#EF9F27]/40 hover:text-[#EF9F27] hover:bg-[#EF9F27]/5 transition-all"
    >
      {topic}
    </button>
  );
}
