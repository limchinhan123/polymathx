"use client";

import { Zap, FileText, RotateCcw, Scale } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

export default function DebateControls() {
  const { state, startRound2, continueDebate, triggerSummarize, triggerJudge, dispatch } =
    useDebate();

  const { status, isLoading } = state;

  // Only show controls when there's something to do
  const showRound2 = status === "round1" && !isLoading;
  const showContinue = (status === "round2" || status === "complete") && !isLoading;
  const showSummarize =
    (status === "round1" || status === "round2" || status === "continuing") && !isLoading;
  const showViewSummary = status === "complete" && state.summary;
  const showGetVerdict =
    status === "complete" && Boolean(state.summary) && !state.judgeVerdict && !state.judgeLoading;
  const showGetVerdictLoading = status === "complete" && state.judgeLoading;

  if (
    !showRound2 &&
    !showContinue &&
    !showSummarize &&
    !showViewSummary &&
    !showGetVerdict &&
    !showGetVerdictLoading &&
    !isLoading
  ) {
    return null;
  }

  return (
    <div className="px-4 py-2 shrink-0 flex gap-2 flex-wrap border-t border-[#1A1A1A]">
      {showRound2 && (
        <button
          onClick={startRound2}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#EF9F27]/10 border border-[#EF9F27]/30 text-[#EF9F27] text-[15px] font-semibold
                     hover:bg-[#EF9F27]/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Zap size={15} />
          Start Round 2
        </button>
      )}

      {showContinue && (
        <button
          onClick={continueDebate}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#141414] border border-[#2A2A2A] text-[#888] text-[15px] font-medium
                     hover:border-[#EF9F27]/30 hover:text-[#EF9F27] active:scale-95 transition-all disabled:opacity-50"
        >
          <RotateCcw size={14} />
          Continue
        </button>
      )}

      {showSummarize && (
        <button
          onClick={triggerSummarize}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#141414] border border-[#2A2A2A] text-[#888] text-[15px] font-medium
                     hover:border-[#8B7CF6]/30 hover:text-[#8B7CF6] active:scale-95 transition-all disabled:opacity-50"
        >
          <FileText size={15} />
          Summarize
        </button>
      )}

      {showViewSummary && (
        <button
          onClick={() => dispatch({ type: "OPEN_SUMMARY" })}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#8B7CF6]/10 border border-[#8B7CF6]/30 text-[#8B7CF6] text-[15px] font-semibold
                     hover:bg-[#8B7CF6]/20 active:scale-95 transition-all"
        >
          <FileText size={15} />
          View Summary
        </button>
      )}

      {showGetVerdict && (
        <button
          type="button"
          onClick={() => void triggerJudge()}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-amber-500/10 border border-amber-500/35 text-amber-400 text-[15px] font-semibold
                     hover:bg-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Scale size={15} />
          Get Verdict
        </button>
      )}

      {showGetVerdictLoading && (
        <button
          type="button"
          disabled
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-amber-500/5 border border-amber-500/20 text-amber-500/70 text-[15px] font-medium opacity-80"
        >
          <Scale size={15} />
          Getting verdict…
        </button>
      )}
    </div>
  );
}
