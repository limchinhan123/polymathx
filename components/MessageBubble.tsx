"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { type Message, MODEL_LABELS, MODEL_COLORS, normalizeLegacyDebaterModelId } from "@/lib/types";
import { getModelInitial } from "@/lib/debate-store";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);

  const modelId = normalizeLegacyDebaterModelId(String(message.model));
  const color = MODEL_COLORS[modelId];
  const label = MODEL_LABELS[modelId];
  const initial = getModelInitial(modelId);
  const isStreaming = message.isStreaming ?? false;

  const paragraphs = message.content.split("\n").filter((p) => p.trim());

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
    <div className="group flex gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold text-white mt-0.5"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + persona row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color }}>
            {label}
          </span>
          {!(modelId === "blackHat" && message.personaTag === "Black Hat") && (
            <span
              className="text-[12px] px-1.5 py-0.5 rounded-full border font-medium"
              style={{
                color,
                borderColor: `${color}40`,
                backgroundColor: `${color}12`,
              }}
            >
              {message.personaTag}
            </span>
          )}
          {modelId === "blackHat" && (
            <span
              className="text-[12px] px-1.5 py-0.5 rounded-full border font-medium bg-[#1A1A1A] text-[#06B6D4] border-[#06B6D4]/35"
              title="Black Hat — stress-testing the idea"
            >
              🎩 Black Hat
            </span>
          )}
          {isStreaming && (
            <span
              className="text-[12px] px-1.5 py-0.5 rounded-full font-medium animate-pulse"
              style={{ color, backgroundColor: `${color}18` }}
            >
              writing…
            </span>
          )}
          <span className="text-[12px] text-[#444] ml-auto tabular-nums">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Bubble */}
        <div className="relative">
          <div
            className="rounded-2xl rounded-tl-sm text-[16px] text-[#E0E0E0]"
            style={{
              backgroundColor: `${color}14`,
              border: `1px solid ${color}22`,
              padding: "14px 16px",
            }}
          >
            {paragraphs.length > 0
              ? paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    style={{
                      marginBottom: i < paragraphs.length - 1 ? "12px" : 0,
                      lineHeight: "1.7",
                    }}
                  >
                    {paragraph}
                  </p>
                ))
              : null}
            {isStreaming && (
              <span
                className="inline-block w-[2px] h-[16px] ml-[2px] align-middle rounded-sm streaming-cursor"
                style={{ backgroundColor: color }}
              />
            )}
          </div>

          {/* Copy button — hide while streaming */}
          {!isStreaming && (
            <button
              onClick={handleCopy}
              aria-label="Copy message"
              className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                         w-6 h-6 flex items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A]
                         text-[#666] hover:text-white hover:border-[#3A3A3A]"
            >
              {copied ? <Check size={10} className="text-[#EF9F27]" /> : <Copy size={10} />}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        .streaming-cursor {
          animation: blink 1s step-start infinite;
        }
      `}</style>
    </div>
  );
}
