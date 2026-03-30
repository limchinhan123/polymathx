"use client";

import { Menu } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

export default function Header() {
  const { state, dispatch } = useDebate();

  const roundLabel =
    state.status === "idle" || state.currentRound === 0
      ? "--"
      : `R${state.currentRound}`;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A] bg-[#0A0A0A] shrink-0">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5">
        <span className="text-lg font-bold tracking-tight text-white">
          Polymath<span className="text-[#EF9F27]">X</span>
        </span>
        {/* Round badge */}
        <span
          className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-2 py-0.5 border"
          style={{
            backgroundColor:
              state.currentRound > 0 ? "rgba(239,159,39,0.15)" : "rgba(42,42,42,0.6)",
            borderColor:
              state.currentRound > 0 ? "rgba(239,159,39,0.4)" : "#2A2A2A",
            color: state.currentRound > 0 ? "#EF9F27" : "#666",
          }}
        >
          {roundLabel}
        </span>
      </div>

      {/* Status indicator */}
      <div className="flex-1 flex justify-center">
        {state.isLoading && (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1">
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[#EF9F27] inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[#EF9F27] inline-block" />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-[#EF9F27] inline-block" />
            </div>
            {state.loadingModel && (
              <span className="text-[12px] text-[#666]">
                {state.loadingModel === "gpt4o"
                  ? "GPT-4o"
                  : state.loadingModel === "claude"
                    ? "Claude"
                    : state.loadingModel === "gemini"
                      ? "Gemini"
                      : state.loadingModel === "grok"
                        ? "Grok"
                        : state.loadingModel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Menu icon — hidden on lg+ (desktop uses sidebar) */}
      <button
        aria-label="Open menu"
        onClick={() => dispatch({ type: "OPEN_DRAWER" })}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[#888] hover:text-white hover:bg-[#1A1A1A] transition-colors"
      >
        <Menu size={18} />
      </button>
      <div className="hidden lg:block w-9 shrink-0" aria-hidden />
    </header>
  );
}
