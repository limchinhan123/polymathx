"use client";

import { useEffect, useState } from "react";
import { Zap, FileText, RotateCcw, Scale } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

export default function DebateControls() {
  const {
    state,
    prepareForRound2,
    startRound2,
    continueDebate,
    triggerSummarize,
    triggerJudge,
    dispatch,
  } = useDebate();

  const { status, isLoading, interRoundContext } = state;

  const [round2PreflightDone, setRound2PreflightDone] = useState(false);
  const [contextAddedFlash, setContextAddedFlash] = useState(false);

  useEffect(() => {
    if (status !== "awaiting_round2") {
      setRound2PreflightDone(false);
      setContextAddedFlash(false);
    }
  }, [status]);

  const showPrepareForRound2 = status === "round1" && !isLoading;
  const showAwaitingRound2 = status === "awaiting_round2" && !isLoading;
  const showContinue = (status === "round2" || status === "complete") && !isLoading;
  const showSummarize =
    (status === "round1" ||
      status === "round2" ||
      status === "continuing" ||
      status === "awaiting_round2") &&
    !isLoading;
  const showViewSummary = status === "complete" && state.summary;
  const showGetVerdict =
    status === "complete" && Boolean(state.summary) && !state.judgeVerdict && !state.judgeLoading;
  const showGetVerdictLoading = status === "complete" && state.judgeLoading;

  const handleReadyForRound2 = () => {
    const has = interRoundContext.trim().length > 0;
    setRound2PreflightDone(true);
    if (has) {
      setContextAddedFlash(true);
      window.setTimeout(() => setContextAddedFlash(false), 2500);
    }
  };

  if (
    !showPrepareForRound2 &&
    !showAwaitingRound2 &&
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
    <div className="px-4 py-2 shrink-0 flex flex-col gap-3 border-t border-[#1A1A1A]">
      {/* Inter-round context first so it stays above action buttons on mobile */}
      {showAwaitingRound2 && (
        <div
          className="order-1 w-full shrink-0"
          style={{
            margin: "0 8px",
            background: "#1A1A1C",
            borderRadius: "12px",
            border: "0.5px solid rgba(255,255,255,0.1)",
            padding: "12px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              color: "#5A5A5A",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            Add context before Round 2 (optional)
          </p>
          <textarea
            placeholder="Answer the moderator's question, add new information, or clarify your position..."
            value={interRoundContext}
            onChange={(e) =>
              dispatch({
                type: "SET_INTER_ROUND_CONTEXT",
                payload: e.target.value,
              })
            }
            disabled={round2PreflightDone}
            style={{
              width: "100%",
              minHeight: "80px",
              background: "transparent",
              border: "none",
              color: "#F0EFE9",
              fontSize: "15px",
              lineHeight: "1.6",
              resize: "none",
              outline: "none",
              fontFamily: "DM Sans, sans-serif",
              opacity: round2PreflightDone ? 0.65 : 1,
            }}
          />
        </div>
      )}

      {showAwaitingRound2 && contextAddedFlash && (
        <p className="order-2 text-center text-[12px] text-emerald-400/90 px-2" role="status">
          Context added ✓
        </p>
      )}

      <div className="order-3 flex flex-col gap-2 w-full">
        <div className="flex gap-2 flex-wrap">
          {showPrepareForRound2 && (
            <button
              type="button"
              onClick={() => void prepareForRound2()}
              disabled={isLoading}
              className="flex-1 flex min-w-[200px] items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                         bg-[#EF9F27]/10 border border-[#EF9F27]/30 text-[#EF9F27] text-[15px] font-semibold
                         hover:bg-[#EF9F27]/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Zap size={15} />
              Continue to Round 2
            </button>
          )}

          {showAwaitingRound2 && !round2PreflightDone && (
            <button
              type="button"
              onClick={handleReadyForRound2}
              className="flex-1 flex min-w-[200px] items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                         bg-[#EF9F27]/10 border border-[#EF9F27]/30 text-[#EF9F27] text-[15px] font-semibold
                         hover:bg-[#EF9F27]/20 active:scale-95 transition-all"
            >
              Ready for Round 2
            </button>
          )}

          {showAwaitingRound2 && round2PreflightDone && (
            <button
              type="button"
              onClick={() => void startRound2()}
              disabled={isLoading}
              className="flex-1 flex min-w-[200px] items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                         bg-[#EF9F27] border border-[#EF9F27] text-black text-[15px] font-semibold
                         hover:bg-[#f0a832] active:scale-95 transition-all disabled:opacity-50"
            >
              <Zap size={15} />
              Start Round 2
            </button>
          )}

          {showContinue && (
            <button
              type="button"
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
              type="button"
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
              type="button"
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
      </div>
    </div>
  );
}
