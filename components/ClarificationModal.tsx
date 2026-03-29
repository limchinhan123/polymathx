"use client";

import { Scale } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

export default function ClarificationModal() {
  const { state, skipClarification, submitClarification, dispatch } = useDebate();

  if (!state.clarificationOpen) return null;

  const { clarifyingQuestions, isLoading, error } = state;
  const clarifyFailed = !isLoading && clarifyingQuestions.length === 0 && error;

  const hasAnswers = clarifyingQuestions.some((q) => q.answer.trim());

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 animate-fade-in"
        onClick={skipClarification}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F0F] border-t border-[#2A2A2A] rounded-t-2xl animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label="Clarifying questions"
      >
        <div className="drag-handle mt-3" />

        <div className="px-4 pb-6">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-xl bg-[#EF9F27]/15 flex items-center justify-center">
              <Scale size={13} className="text-[#EF9F27]" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white">Clarify the topic</h3>
              <p className="text-[10px] text-[#555]">DeepSeek asks — optional</p>
            </div>
          </div>

          {/* Questions */}
          {isLoading && clarifyingQuestions.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-[#141414] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {clarifyingQuestions.map((q) => (
                <div key={q.id} className="rounded-xl bg-[#141414] border border-[#2A2A2A] p-3">
                  <p className="text-[11px] text-[#888] mb-1.5">{q.question}</p>
                  <input
                    type="text"
                    value={q.answer}
                    onChange={(e) =>
                      dispatch({
                        type: "ANSWER_CLARIFYING_QUESTION",
                        payload: { id: q.id, answer: e.target.value },
                      })
                    }
                    placeholder="Your answer (optional)"
                    className="w-full bg-transparent border-b border-[#2A2A2A] text-[12px] text-white
                               placeholder-[#333] outline-none pb-1 focus:border-[#EF9F27]/50"
                  />
                </div>
              ))}
            </div>
          )}

          {clarifyFailed && (
            <div
              role="alert"
              className="mt-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2.5 text-[11px] text-red-200/95 leading-relaxed"
            >
              {error}
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
                className="mt-2 block text-[10px] font-medium text-red-300 underline-offset-2 hover:underline"
              >
                Dismiss message
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={skipClarification}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl border border-[#2A2A2A] text-[12px] text-[#666]
                         hover:text-[#999] hover:border-[#3A3A3A] transition-all disabled:opacity-40"
            >
              {clarifyFailed ? "Start without questions" : "Skip"}
            </button>
            <button
              onClick={hasAnswers ? submitClarification : skipClarification}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl bg-[#EF9F27] text-black text-[12px] font-semibold
                         hover:bg-[#F5AB3A] active:scale-95 transition-all disabled:opacity-40"
            >
              {hasAnswers ? "Start Debate" : "Start Anyway"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
