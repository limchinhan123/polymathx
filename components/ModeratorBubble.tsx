"use client";

import { useState } from "react";
import { Copy, Check, Scale, Sparkles } from "lucide-react";
import { type Message } from "@/lib/types";
import { useDebate } from "@/lib/debate-store";

interface ModeratorBubbleProps {
  message: Message;
}

export default function ModeratorBubble({ message }: ModeratorBubbleProps) {
  const [copied, setCopied] = useState(false);
  const { triggerSummarize } = useDebate();

  const score = message.agreementScore;
  const isConverging = typeof score === "number" && score >= 8;

  // Bar color based on score
  const barColor =
    typeof score === "number"
      ? score <= 3
        ? "#EF9F27" // amber — high disagreement
        : score <= 6
        ? "#4285F4" // blue — partial
        : "#22c55e" // green — converging
      : "#EF9F27";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div className="group px-4 py-3 mx-4 my-3 rounded-2xl border border-dashed border-[#EF9F27]/30 bg-[#EF9F27]/5">
      {/* Moderator header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#EF9F27]/20 flex items-center justify-center">
            <Scale size={11} className="text-[#EF9F27]" />
          </div>
          <span className="text-[11px] font-semibold text-[#EF9F27]">DeepSeek</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[#EF9F27]/30 text-[#EF9F27]/70 font-medium">
            Moderator
          </span>
        </div>
        <button
          onClick={handleCopy}
          aria-label="Copy moderator message"
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center
                     rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#666] hover:text-[#EF9F27]"
        >
          {copied ? <Check size={10} className="text-[#EF9F27]" /> : <Copy size={10} />}
        </button>
      </div>

      {/* Content */}
      <p className="text-[12px] leading-relaxed text-[#CCC]">{message.content}</p>

      {/* Agreement score bar */}
      {typeof score === "number" && (
        <div className="mt-3 pt-2.5 border-t border-[#EF9F27]/15">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[#666] font-medium">Agreement</span>
            <span className="text-[10px] font-semibold" style={{ color: barColor }}>
              {score}/10
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#1A1A1A] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${score * 10}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
      )}

      {/* Converging banner */}
      {isConverging && (
        <div className="mt-2.5 flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#22c55e]/8 border border-[#22c55e]/20">
          <Sparkles size={11} className="text-[#22c55e] shrink-0" />
          <span className="text-[11px] text-[#22c55e]/90 flex-1">
            Models are converging. Consider summarizing.
          </span>
          <button
            onClick={triggerSummarize}
            className="text-[10px] font-semibold text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded-lg
                       hover:bg-[#22c55e]/15 active:scale-95 transition-all whitespace-nowrap"
          >
            Summarize now
          </button>
        </div>
      )}
    </div>
  );
}
