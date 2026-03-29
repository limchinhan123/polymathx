"use client";

import { Zap, FileText, RotateCcw } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

export default function DebateControls() {
  const { state, startRound2, continueDebate, triggerSummarize, dispatch } = useDebate();

  const { status, isLoading } = state;

  // Only show controls when there's something to do
  const showRound2 = status === "round1" && !isLoading;
  const showContinue = (status === "round2" || status === "complete") && !isLoading;
  const showSummarize =
    (status === "round1" || status === "round2" || status === "continuing") && !isLoading;
  const showViewSummary = status === "complete" && state.summary;

  if (!showRound2 && !showContinue && !showSummarize && !showViewSummary && !isLoading) {
    return null;
  }

  return (
    <div className="px-4 py-2 shrink-0 flex gap-2 flex-wrap border-t border-[#1A1A1A]">
      {showRound2 && (
        <button
          onClick={startRound2}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#EF9F27]/10 border border-[#EF9F27]/30 text-[#EF9F27] text-[12px] font-semibold
                     hover:bg-[#EF9F27]/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <Zap size={13} />
          Start Round 2
        </button>
      )}

      {showContinue && (
        <button
          onClick={continueDebate}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#141414] border border-[#2A2A2A] text-[#888] text-[12px] font-medium
                     hover:border-[#EF9F27]/30 hover:text-[#EF9F27] active:scale-95 transition-all disabled:opacity-50"
        >
          <RotateCcw size={12} />
          Continue
        </button>
      )}

      {showSummarize && (
        <button
          onClick={triggerSummarize}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#141414] border border-[#2A2A2A] text-[#888] text-[12px] font-medium
                     hover:border-[#8B7CF6]/30 hover:text-[#8B7CF6] active:scale-95 transition-all disabled:opacity-50"
        >
          <FileText size={13} />
          Summarize
        </button>
      )}

      {showViewSummary && (
        <button
          onClick={() => dispatch({ type: "OPEN_SUMMARY" })}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                     bg-[#8B7CF6]/10 border border-[#8B7CF6]/30 text-[#8B7CF6] text-[12px] font-semibold
                     hover:bg-[#8B7CF6]/20 active:scale-95 transition-all"
        >
          <FileText size={13} />
          View Summary
        </button>
      )}
    </div>
  );
}
