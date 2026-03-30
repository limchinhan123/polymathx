"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Mic, Send, Loader2, Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";
import { useDebate } from "@/lib/debate-store";
import { processFile } from "@/lib/file-processor";

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

/** Matches `text-[16px] leading-[1.6]` + `py-2.5` (10px × 2) for auto-grow cap. */
const TEXTAREA_LINE_HEIGHT_PX = 16 * 1.6;
const TEXTAREA_PAD_Y_PX = 20;
const TEXTAREA_MAX_LINES = 5;
const TEXTAREA_MAX_HEIGHT_PX =
  TEXTAREA_PAD_Y_PX + TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT_PX;

export default function InputRow() {
  const { state, dispatch, startDebate } = useDebate();
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [isSuggested, setIsSuggested] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const baseTextRef = useRef("");
  const sessionFinalRef = useRef("");
  const voiceHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attachedFile = state.attachedFile;

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

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [text, syncTextareaHeight, isIdle, isLoading, isListening, isComplete]);

  const clearFile = useCallback(() => {
    dispatch({ type: "CLEAR_FILE" });
    setIsSuggested(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [dispatch]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileError(null);
      setFileLoading(true);
      try {
        const processed = await processFile(file);
        dispatch({ type: "ATTACH_FILE", payload: processed });

        // Only suggest topic when text field is empty
        if (!text.trim() && !processed.isImage && processed.text) {
          try {
            const res = await fetch("/api/suggest-topic", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileName: processed.name,
                fileText: processed.text,
              }),
            });
            if (res.ok) {
              const data = (await res.json()) as { topic: string };
              if (data.topic) {
                setText(data.topic);
                setIsSuggested(true);
              }
            }
          } catch {
            // Non-fatal — suggestion is optional
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not read file — please try again";
        setFileError(msg);
        setTimeout(() => setFileError(null), 3500);
      } finally {
        setFileLoading(false);
        // Reset so same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [dispatch, text]
  );

  const handleSend = () => {
    if (!canSend) return;
    const topic = text.trim();
    setText("");
    setIsSuggested(false);
    startDebate(topic);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const micDisabled = !isIdle || isLoading;

  const hasFile = !!attachedFile;

  return (
    <div className="px-4 py-3 pb-safe shrink-0 bg-[#0A0A0A] border-t border-[#1A1A1A]">
      {/* Status hints */}
      {(voiceHint ?? fileError) && (
        <p
          className={`text-center text-[11px] mb-2 ${fileError ? "text-red-400/90" : "text-amber-500/90"}`}
          role="status"
        >
          {fileError ?? voiceHint}
        </p>
      )}

      {/* File pill */}
      {attachedFile && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-full
                          pl-2 pr-1.5 py-1 max-w-full min-w-0">
            {attachedFile.isImage && attachedFile.base64 ? (
              // Thumbnail for images (base64 data URI — next/image supports unoptimized data URIs)
              <NextImage
                src={attachedFile.base64}
                alt=""
                width={24}
                height={24}
                unoptimized
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : attachedFile.isImage ? (
              <ImageIcon size={13} className="text-[#EF9F27] shrink-0" />
            ) : (
              <FileText size={13} className="text-[#EF9F27] shrink-0" />
            )}
            <span className="text-[12px] text-[#CCC] truncate max-w-[180px] sm:max-w-[260px]">
              {attachedFile.name.length > 30
                ? attachedFile.name.slice(0, 27) + "…"
                : attachedFile.name}
            </span>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={clearFile}
              className="ml-0.5 text-[#555] hover:text-[#CCC] transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>
          {isSuggested && (
            <span className="text-[11px] text-[#555] italic">suggested topic</span>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
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

        {/* Paperclip button */}
        <button
          type="button"
          aria-label="Attach file"
          disabled={!isIdle || isLoading || fileLoading}
          onClick={() => fileInputRef.current?.click()}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors disabled:opacity-30
            ${hasFile ? "text-[#EF9F27]" : "text-[#444] hover:text-[#888] hover:bg-[#141414]"}`}
        >
          {fileLoading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
          aria-hidden="true"
        />

        {/* Topic / message (multi-line, Enter sends, Shift+Enter newline) */}
        <div className="flex-1 relative min-w-0">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); setIsSuggested(false); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={!isIdle || isLoading || isListening}
    
            rows={1}
            enterKeyHint="send"
            className="w-full min-w-0 bg-[#141414] border border-[#2A2A2A] rounded-2xl px-4 py-2.5
                       text-[16px] leading-[1.6] text-white placeholder-[#3A3A3A] outline-none
                       focus:border-[#EF9F27]/40 focus:ring-1 focus:ring-[#EF9F27]/20
                       disabled:opacity-40 transition-all
                       resize-none overflow-y-auto"
            style={{ maxHeight: TEXTAREA_MAX_HEIGHT_PX }}
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
