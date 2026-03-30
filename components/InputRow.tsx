"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  Mic,
  Send,
  Loader2,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  ChevronDown,
} from "lucide-react";
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

const MOBILE_EXPANDED_TEXTAREA_MIN_PX = 120;
const MOBILE_EXPANDED_TEXTAREA_MAX_PX = 300;

function detectMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export default function InputRow() {
  const { state, dispatch, startDebate } = useDebate();
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [isSuggested, setIsSuggested] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileSheetAnimatingIn, setMobileSheetAnimatingIn] = useState(false);

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

  useEffect(() => {
    setIsMobile(detectMobileUa());
  }, []);

  const closeMobileComposer = useCallback(() => {
    setMobileSheetAnimatingIn(false);
    window.setTimeout(() => setMobileExpanded(false), 250);
  }, []);

  const openMobileComposer = useCallback(() => {
    setMobileExpanded(true);
    setMobileSheetAnimatingIn(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileSheetAnimatingIn(true));
    });
  }, []);

  useEffect(() => {
    if (!isMobile || !mobileExpanded || !mobileSheetAnimatingIn) return;
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isMobile, mobileExpanded, mobileSheetAnimatingIn]);

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (isMobile && mobileExpanded) {
      const h = Math.min(
        Math.max(el.scrollHeight, MOBILE_EXPANDED_TEXTAREA_MIN_PX),
        MOBILE_EXPANDED_TEXTAREA_MAX_PX
      );
      el.style.height = `${h}px`;
    } else {
      el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
    }
  }, [isMobile, mobileExpanded]);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [
    text,
    syncTextareaHeight,
    isIdle,
    isLoading,
    isListening,
    isComplete,
    mobileExpanded,
    isMobile,
  ]);

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

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const topic = text.trim();
    setText("");
    setIsSuggested(false);
    if (isMobile) closeMobileComposer();
    startDebate(topic);
  }, [canSend, text, isMobile, closeMobileComposer, startDebate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isMobile) {
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [isMobile, handleSend]
  );

  const micDisabled = !isIdle || isLoading;

  const hasFile = !!attachedFile;

  const lineCount = text === "" ? 0 : text.split("\n").length;
  const charCount = text.length;

  const collapsedMobilePreview =
    text.trim() === ""
      ? placeholder
      : text.replace(/\n/g, " ").trim();

  const micButton = (
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
  );

  const clipButton = (
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
  );

  const sendIconButton = (
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
  );

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

      {/* Hidden file input (shared) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
        aria-hidden="true"
      />

      {isMobile ? (
        <>
          {mobileExpanded && (
            <div className="fixed inset-x-0 bottom-0 z-[100] h-[50dvh] pointer-events-none">
              <div
                className="pointer-events-auto h-full flex flex-col px-4 pt-4 pb-4 pb-safe
                  transition-[transform,opacity] duration-[250ms] ease-out"
                style={{
                  transform: mobileSheetAnimatingIn ? "translateY(0)" : "translateY(100%)",
                  opacity: mobileSheetAnimatingIn ? 1 : 0,
                  backgroundColor: "var(--bg2, #1A1A1C)",
                  borderTop: "0.5px solid rgba(255,255,255,0.1)",
                  borderRadius: "20px 20px 0 0",
                }}
              >
                <div className="flex items-center justify-between shrink-0 mb-3 gap-2">
                  <button
                    type="button"
                    aria-label="Collapse composer"
                    onClick={closeMobileComposer}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-white
                      hover:bg-white/10 transition-colors"
                  >
                    <ChevronDown size={22} strokeWidth={2} />
                  </button>
                  <span className="text-[11px] text-[#888] tabular-nums shrink-0">
                    {charCount} chars · {lineCount} lines
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setIsSuggested(false);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={!isIdle || isLoading || isListening}
                  rows={4}
                  enterKeyHint="enter"
                  className="w-full shrink-0 min-h-[120px] max-h-[300px] mb-3
                    text-[16px] leading-[1.6] text-white placeholder-[#3A3A3A] outline-none
                    bg-transparent border-0 resize-none overflow-y-auto
                    disabled:opacity-40"
                />

                <div className="flex-1 min-h-0" aria-hidden="true" />

                <div className="flex items-end justify-between gap-3 shrink-0">
                  <div className="flex items-end gap-2">
                    {micButton}
                    {clipButton}
                  </div>
                  <button
                    type="button"
                    aria-label="Send"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="rounded-[12px] px-5 py-2.5 text-[15px] font-semibold transition-all active:scale-[0.98]
                      disabled:opacity-30"
                    style={{
                      backgroundColor: canSend ? "#EF9F27" : "#2A2A2A",
                      color: canSend ? "#000" : "#666",
                    }}
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin inline" />
                    ) : (
                      "Send"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!mobileExpanded && (
            <div className="flex items-end gap-2">
              {micButton}
              {clipButton}
              <button
                type="button"
                disabled={!isIdle || isLoading}
                onClick={() => {
                  if (!isIdle || isLoading) return;
                  openMobileComposer();
                }}
                className="flex-1 min-w-0 h-11 rounded-2xl border border-[#2A2A2A] bg-[#141414] px-4 text-left
                  text-[16px] leading-[1.6] outline-none focus-visible:border-[#EF9F27]/40
                  focus-visible:ring-1 focus-visible:ring-[#EF9F27]/20
                  disabled:opacity-40 transition-all overflow-hidden"
              >
                <span
                  className={`block truncate ${collapsedMobilePreview === placeholder ? "text-[#3A3A3A]" : "text-white"}`}
                >
                  {collapsedMobilePreview}
                </span>
              </button>
              {sendIconButton}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-end gap-2">
          {micButton}
          {clipButton}

          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setIsSuggested(false);
              }}
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

          {sendIconButton}
        </div>
      )}
    </div>
  );
}
