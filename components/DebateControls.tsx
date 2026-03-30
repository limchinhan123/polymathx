"use client";

import { Zap, FileText, Scale, Loader2 } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

function hasStreamingInRound(
  messages: { round: number; isModerator: boolean; isStreaming?: boolean }[],
  round: number
) {
  return messages.some((m) => !m.isModerator && m.round === round && m.isStreaming);
}

/** Inter-round pause after moderation or stream timeout (before the next debater round). */
function isPendingRoundStatus(status: string): boolean {
  return status === "pending_round";
}

export default function DebateControls() {
  const { state, prepareForRound2, startRound2, triggerSummarize, triggerJudge, dispatch } =
    useDebate();

  const { status, isLoading, interRoundContext, currentRound, pendingRound, messages } = state;

  const streamingCurrent =
    currentRound > 0 && hasStreamingInRound(messages, currentRound);

  const showPrepareModeration =
    (status === "round1" || status === "debating") &&
    !isLoading &&
    currentRound > 0 &&
    !hasStreamingInRound(messages, currentRound);

  const showAwaitingInterRound = isPendingRoundStatus(status) && !isLoading;

  const prepareLabel =
    currentRound === 1
      ? "Get Moderator's Take →"
      : `Prepare Round ${currentRound + 1}`;

  const startNextLabel =
    pendingRound >= 1 ? `Start Round ${pendingRound}` : `Start Round ${currentRound + 1}`;

  // Do not offer Summarize after Round 1 only — user must reach moderation / Round 2 path first.
  const showSummarize =
    !isLoading &&
    ((status === "debating" && currentRound >= 2 && !streamingCurrent) ||
      (showAwaitingInterRound && currentRound >= 2));

  const canShowCompletedActions =
    status === "complete" && state.summary != null && !isPendingRoundStatus(status);

  const showViewSummary = canShowCompletedActions;
  const showGetVerdict =
    canShowCompletedActions && !state.judgeVerdict && !state.judgeLoading;
  const showGetVerdictLoading =
    status === "complete" && state.summary != null && state.judgeLoading;

  const showSummarizingBar = status === "summarizing" && isLoading;

  if (
    !showPrepareModeration &&
    !showAwaitingInterRound &&
    !showSummarize &&
    !showViewSummary &&
    !showGetVerdict &&
    !showGetVerdictLoading &&
    !showSummarizingBar &&
    !isLoading
  ) {
    return null;
  }

  return (
    <div className="px-4 py-2 shrink-0 flex flex-col gap-3 border-t border-[#1A1A1A]">
      {showSummarizingBar && (
        <div className="flex items-center justify-center gap-2 py-2 text-[13px] text-[#888]">
          <Loader2 size={16} className="animate-spin text-[#EF9F27]" />
          Summarizing…
        </div>
      )}

      {showAwaitingInterRound && currentRound >= 1 && (
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
            {`Add context before Round ${pendingRound >= 1 ? pendingRound : currentRound + 1} (optional)`}
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
            }}
          />
        </div>
      )}

      <div className="order-2 flex flex-col gap-2 w-full">
        <div className="flex gap-2 flex-wrap">
          {showPrepareModeration && (
            <button
              type="button"
              onClick={() => void prepareForRound2()}
              disabled={isLoading}
              className="flex-1 flex min-w-[200px] items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                         bg-[#EF9F27]/10 border border-[#EF9F27]/30 text-[#EF9F27] text-[15px] font-semibold
                         hover:bg-[#EF9F27]/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Zap size={15} />
              {prepareLabel}
            </button>
          )}

          {showAwaitingInterRound && (
            <button
              type="button"
              onClick={() => void startRound2()}
              disabled={isLoading}
              className="flex-1 flex min-w-[200px] items-center justify-center gap-2 py-2.5 px-3 rounded-xl
                         bg-[#EF9F27] border border-[#EF9F27] text-black text-[15px] font-semibold
                         hover:bg-[#f0a832] active:scale-95 transition-all disabled:opacity-50"
            >
              <Zap size={15} />
              {startNextLabel}
            </button>
          )}

          {showSummarize && (
            <button
              type="button"
              onClick={() => void triggerSummarize()}
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
