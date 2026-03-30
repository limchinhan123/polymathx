"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Mic, Send, Loader2 } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

/** Local types — Web Speech API (DOM lib may omit these in some TS configs). */
interface WebSpeechResult {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface WebSpeechResultList {
  readonly length: number;
  readonly [index: number]: WebSpeechResult;
}

interface WebSpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: WebSpeechResultList;
}

interface WebSpeechRecognitionErrorEvent {
  readonly error: string;
}

interface WebSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => WebSpeechRecognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export default function InputRow() {
  const { state, startDebate } = useDebate();
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const baseTextRef = useRef("");
  const sessionFinalRef = useRef("");
  const voiceHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isIdle = state.status === "idle";
  const isLoading = state.isLoading;
  const isComplete = state.status === "complete";

  const placeholder = isListening
    ? "Listening… tap mic to stop"
    : isIdle
      ? "What should we explore?"
      : isComplete
        ? "Complete — start fresh"
        : "Observe the exchange…";

  const canSend = isIdle && text.trim().length > 0 && !isLoading;

  const showVoiceUnavailable = useCallback(() => {
    if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
    setVoiceHint("Voice not available");
    voiceHintTimerRef.current = setTimeout(() => {
      setVoiceHint(null);
      voiceHintTimerRef.current = null;
    }, 2500);
  }, []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
      }
    }
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showVoiceUnavailable();
      return;
    }

    baseTextRef.current = text;
    sessionFinalRef.current = "";

    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event: WebSpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result[0]?.transcript ?? "";
        if (result.isFinal) {
          sessionFinalRef.current += piece;
        } else {
          interim += piece;
        }
      }
      const prefix = baseTextRef.current;
      const spoken = sessionFinalRef.current + interim;
      const spacer = prefix && spoken.trim() ? " " : "";
      setText(prefix + spacer + spoken);
    };

    rec.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;
      setIsListening(false);
      recognitionRef.current = null;
      showVoiceUnavailable();
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    try {
      rec.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      showVoiceUnavailable();
    }
  }, [text, showVoiceUnavailable]);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (voiceHintTimerRef.current) clearTimeout(voiceHintTimerRef.current);
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* ignore */
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const handleSend = () => {
    if (!canSend) return;
    const topic = text.trim();
    setText("");
    startDebate(topic);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const micDisabled = !isIdle || isLoading;

  return (
    <div className="px-4 py-3 pb-safe shrink-0 bg-[#0A0A0A] border-t border-[#1A1A1A]">
      {voiceHint && (
        <p className="text-center text-[11px] text-amber-500/90 mb-2" role="status">
          {voiceHint}
        </p>
      )}
      <div className="flex items-center gap-2">
        {/* Mic button */}
        <button
          type="button"
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={isListening}
          disabled={micDisabled}
          onClick={toggleVoice}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors disabled:opacity-30
            ${
              isListening
                ? "text-[#EF9F27] bg-[#EF9F27]/20 ring-2 ring-[#EF9F27]/40 animate-pulse"
                : "text-[#444] hover:text-[#888] hover:bg-[#141414]"
            }`}
        >
          <Mic size={18} />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={!isIdle || isLoading || isListening}
            maxLength={300}
            className="w-full bg-[#141414] border border-[#2A2A2A] rounded-2xl px-4 py-2.5
                       text-[16px] leading-[1.6] text-white placeholder-[#3A3A3A] outline-none
                       focus:border-[#EF9F27]/40 focus:ring-1 focus:ring-[#EF9F27]/20
                       disabled:opacity-40 transition-all"
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          aria-label="Send"
          onClick={handleSend}
          disabled={!canSend}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90
                     disabled:opacity-30"
          style={{
            backgroundColor: canSend ? "#EF9F27" : "#141414",
            color: canSend ? "#000" : "#444",
            border: canSend ? "none" : "1px solid #2A2A2A",
          }}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={15} />
          )}
        </button>
      </div>
    </div>
  );
}
