"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { useDebate, selectRounds } from "@/lib/debate-store";
import { getOrPickIdleSuggestions } from "@/lib/idle-suggestions";
import MessageBubble from "./MessageBubble";
import ModeratorBubble from "./ModeratorBubble";
import RoundDivider from "./RoundDivider";
import TypingIndicator from "./TypingIndicator";
import JudgeVerdict from "./JudgeVerdict";
import { type Message } from "@/lib/types";

const DEBATER_ORDER = ["claude", "gpt4o", "gemini", "blackHat"] as const;

function sortDebaters(msgs: Message[]): Message[] {
  return [...msgs].sort(
    (a, b) => DEBATER_ORDER.indexOf(a.model as (typeof DEBATER_ORDER)[number]) - DEBATER_ORDER.indexOf(b.model as (typeof DEBATER_ORDER)[number])
  );
}

export default function ChatThread() {
  const { state, dispatch } = useDebate();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.isLoading, state.error, state.judgeVerdict]);

  const [idleSuggestions, setIdleSuggestions] = useState<string[] | null>(null);

  useLayoutEffect(() => {
    if (state.status !== "idle") {
      setIdleSuggestions(null);
      return;
    }
    setIdleSuggestions(getOrPickIdleSuggestions());
  }, [state.status]);

  if (state.status === "idle") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 chat-thread overflow-y-auto">
        <h2 className="text-xl font-semibold tracking-tight">
          <span className="text-[#EF9F27]">X</span>
          <span className="text-white">pand your perspective</span>
        </h2>
        <p className="text-base text-[#666] leading-[1.65] max-w-[320px] md:max-w-md">
          Enter a topic below and watch Claude, GPT-4o, and Gemini debate it — with optional DeepSeek R1 in Black Hat
          mode, Mistral moderation, and Gemini summaries.
        </p>
        <div className="flex flex-col gap-2 w-full max-w-[280px] md:max-w-md mt-2 min-h-[132px]">
          {idleSuggestions === null ? (
            <div className="flex flex-col gap-2 w-full" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-xl bg-[#141414] border border-[#1A1A1A] animate-pulse"
                />
              ))}
            </div>
          ) : (
            idleSuggestions.map((topic) => (
              <ExampleTopicChip key={topic} topic={topic} />
            ))
          )}
        </div>
      </div>
    );
  }

  const rounds = selectRounds(state.messages);
  const blocks = buildRoundBlocks(state.messages, rounds);

  return (
    <div className="flex-1 overflow-y-auto chat-thread py-2 min-h-0" aria-live="polite" aria-label="Debate chat">
      {state.error && (
        <div
          role="alert"
          className="sticky top-0 z-10 mx-3 mb-2 flex items-start gap-2 rounded-xl border border-red-500/35 bg-red-950/50 px-3 py-2.5 text-[13px] leading-[1.5] text-red-100/95 shadow-lg backdrop-blur-sm"
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

      {blocks.map((block, i) => {
        if (block.kind === "divider") {
          return <RoundDivider key={`d-${block.round}-${i}`} round={block.round} />;
        }
        if (block.kind === "moderator") {
          return <ModeratorBubble key={block.message.id} message={block.message} />;
        }
        const sorted = sortDebaters(block.messages);
        return (
          <div
            key={`deb-${block.round}-${i}`}
            className="flex flex-col gap-3 w-full max-w-bubble mx-auto px-0"
          >
            {sorted.map((m) => (
              <div key={m.id} className="min-w-0 w-full">
                <MessageBubble message={m} />
              </div>
            ))}
          </div>
        );
      })}

      {state.isLoading && state.loadingModel && (
        <TypingIndicator model={state.loadingModel} />
      )}

      {state.judgeLoading && (
        <div className="px-4 py-3 text-[14px] text-[#888]">Judge is deliberating…</div>
      )}

      <JudgeVerdict />

      <div ref={bottomRef} className="h-2" />
    </div>
  );
}

type Block =
  | { kind: "divider"; round: number }
  | { kind: "debaters"; round: number; messages: Message[] }
  | { kind: "moderator"; message: Message };

function buildRoundBlocks(messages: Message[], rounds: number[]): Block[] {
  const blocks: Block[] = [];
  const moderatorMessages = messages.filter((m) => m.isModerator);
  const roundMessages = (round: number) =>
    messages.filter((m) => m.round === round && !m.isModerator);

  rounds.forEach((round, idx) => {
    blocks.push({ kind: "divider", round });
    const msgs = roundMessages(round);
    if (msgs.length > 0) {
      blocks.push({ kind: "debaters", round, messages: msgs });
    }
    const mod = moderatorMessages[idx];
    if (mod) blocks.push({ kind: "moderator", message: mod });
  });

  if (moderatorMessages.length > rounds.length) {
    moderatorMessages.slice(rounds.length).forEach((m) => {
      blocks.push({ kind: "moderator", message: m });
    });
  }

  return blocks;
}

function ExampleTopicChip({ topic }: { topic: string }) {
  const { startDebate } = useDebate();
  return (
    <button
      type="button"
      onClick={() => startDebate(topic)}
      className="text-left text-[15px] px-3 py-2.5 rounded-xl border border-[#2A2A2A] text-[#888]
                 hover:border-[#EF9F27]/40 hover:text-[#EF9F27] hover:bg-[#EF9F27]/5 transition-all w-full leading-snug"
    >
      {topic}
    </button>
  );
}
