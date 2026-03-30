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
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F0F] border-t border-[#2A2A2A] rounded-t-2xl animate-slide-up max-h-[min(92vh,720px)] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Clarifying questions"
      >
        <div className="drag-handle mt-3 shrink-0" />

        <div className="px-4 pb-6 pt-1 overflow-y-auto min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-[#EF9F27]/15 flex items-center justify-center shrink-0">
              <Scale size={18} className="text-[#EF9F27]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-white leading-snug tracking-tight">
                Clarify the topic
              </h3>
              <p className="text-[13px] text-[#666] leading-[1.5] mt-0.5">
                A few quick questions — optional
              </p>
            </div>
          </div>

          {/* Questions */}
          {isLoading && clarifyingQuestions.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-[#141414] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {clarifyingQuestions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl bg-[#141414] border border-[#2A2A2A] p-4"
                >
                  <p className="text-[16px] text-[#D0D0D0] leading-[1.6] mb-3">{q.question}</p>
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
                    className="w-full bg-[#0A0A0A]/80 border border-[#2A2A2A] rounded-lg px-3 py-2.5 text-[16px] leading-[1.5] text-white
                               placeholder:text-[#555] placeholder:text-[16px] outline-none
                               focus:border-[#EF9F27]/45 focus:ring-1 focus:ring-[#EF9F27]/15"
                  />
                </div>
              ))}
            </div>
          )}

          {clarifyFailed && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-[14px] text-red-200/95 leading-[1.55]"
            >
              {error}
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
                className="mt-2 block text-[13px] font-medium text-red-300 underline-offset-2 hover:underline"
              >
                Dismiss message
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={skipClarification}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl border border-[#2A2A2A] text-[15px] text-[#AAA] leading-snug
                         hover:text-[#CCC] hover:border-[#3A3A3A] transition-all disabled:opacity-40"
            >
              {clarifyFailed ? "Start without questions" : "Skip"}
            </button>
            <button
              type="button"
              onClick={hasAnswers ? submitClarification : skipClarification}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-[#EF9F27] text-black text-[15px] font-semibold leading-snug
                         hover:bg-[#F5AB3A] active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {hasAnswers ? "Start Debate" : "Start Anyway"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
