"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { useDebate } from "@/lib/debate-store";
import {
  getOrCreateDeviceId,
  setHistorySyncKey,
  HISTORY_SYNC_KEY_CHANGED_EVENT,
} from "@/lib/device-id";
import {
  type DebateStyle,
  type ClaudePersona,
  type GptPersona,
  type GeminiPersona,
  type ClaudeModel,
  type GptModel,
  type GeminiModel,
  type ModeratorModel,
  type SummarizerModel,
} from "@/lib/types";

export default function SettingsTab() {
  const { state, updateSettings } = useDebate();
  const { settings } = state;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <HistorySyncSection />

      {/* ── Debaters ── */}
      <Section title="Debaters">
        <ModelSelect
          label="Claude"
          color="#8B7CF6"
          value={settings.claudeModel}
          options={[
            { value: "claude-3-5-sonnet-20241022", label: "Sonnet 3.5" },
            { value: "claude-3-haiku-20240307", label: "Haiku 3" },
          ]}
          onChange={(v) => updateSettings({ claudeModel: v as ClaudeModel })}
        />
        <ModelSelect
          label="GPT-4o"
          color="#10A37F"
          value={settings.gptModel}
          options={[
            { value: "gpt-4o", label: "GPT-4o" },
            { value: "gpt-4o-mini", label: "GPT-4o mini" },
          ]}
          onChange={(v) => updateSettings({ gptModel: v as GptModel })}
        />
        <ModelSelect
          label="Gemini"
          color="#4285F4"
          value={settings.geminiModel}
          options={[
            { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
            { value: "google/gemini-flash-1.5-8b", label: "Gemini Flash 1.5 8B" },
          ]}
          onChange={(v) => updateSettings({ geminiModel: v as GeminiModel })}
        />
      </Section>

      {/* ── Moderator & Summarizer ── */}
      <Section title="Roles">
        <p className="text-[10px] text-[#555] -mt-2 mb-1 leading-relaxed">
          Moderator runs between rounds; summarizer produces the final write-up (OpenRouter).
        </p>
        <ModelSelect
          label="Moderator"
          color="#EF9F27"
          value={settings.moderatorModel}
          options={[
            { value: "deepseek/deepseek-chat", label: "DeepSeek" },
            { value: "claude-3-haiku-20240307", label: "Claude Haiku" },
          ]}
          onChange={(v) => updateSettings({ moderatorModel: v as ModeratorModel })}
        />
        <ModelSelect
          label="Summarizer"
          color="#8B7CF6"
          value={settings.summarizerModel}
          options={[
            { value: "claude-3-5-sonnet-20241022", label: "Claude Sonnet" },
            { value: "claude-3-haiku-20240307", label: "Claude Haiku" },
          ]}
          onChange={(v) => updateSettings({ summarizerModel: v as SummarizerModel })}
        />
      </Section>

      {/* ── Temperature ── */}
      <Section title="Temperature">
        <div className="space-y-2">
          <span className="text-[11px] text-[#666]">Creativity / Randomness</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={settings.temperature}
              defaultValue={0.7}
              onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
              className="flex-1"
              aria-label="Temperature"
            />
            <span className="text-[13px] font-mono font-semibold text-[#EF9F27] w-7 text-right tabular-nums">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-[#444]">
            <span>Focused</span>
            <span>Creative</span>
          </div>
        </div>
      </Section>

      {/* ── Debate Style ── */}
      <Section title="Debate Style">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/80 p-3 mb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#E0E0E0]">Black Hat Mode</p>
              <p className="text-[10px] text-[#666] mt-1 leading-relaxed">
                Forces Gemini to argue against the idea
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.blackHatMode}
              aria-label="Black Hat mode"
              onClick={() => updateSettings({ blackHatMode: !settings.blackHatMode })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EF9F27]/50 ${
                settings.blackHatMode ? "bg-[#EF9F27]" : "bg-[#2A2A2A]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.blackHatMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
        <ChipGroup
          options={["Steel-man", "Socratic", "Devil's Advocate", "Collaborative"] as DebateStyle[]}
          value={settings.debateStyle}
          color="#EF9F27"
          onChange={(v) => updateSettings({ debateStyle: v as DebateStyle })}
        />
      </Section>

      {/* ── Personas ── */}
      <Section title="Claude Persona">
        <ChipGroup
          options={["First Principles", "Contrarian", "Ethicist", "Strategist"] as ClaudePersona[]}
          value={settings.claudePersona}
          color="#8B7CF6"
          onChange={(v) => updateSettings({ claudePersona: v as ClaudePersona })}
        />
      </Section>

      <Section title="GPT-4o Persona">
        <ChipGroup
          options={["Pragmatist", "Historicist", "Optimist", "Devil's Advocate"] as GptPersona[]}
          value={settings.gptPersona}
          color="#10A37F"
          onChange={(v) => updateSettings({ gptPersona: v as GptPersona })}
        />
      </Section>

      <Section title="Gemini Persona">
        <ChipGroup
          options={["Data/Evidence", "Futurist", "Skeptic", "Systems Thinker"] as GeminiPersona[]}
          value={settings.geminiPersona}
          color="#4285F4"
          onChange={(v) => updateSettings({ geminiPersona: v as GeminiPersona })}
        />
      </Section>

      <div className="h-8" />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HistorySyncSection() {
  const [syncKey, setSyncKey] = useState("");
  const [paste, setPaste] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const refreshKey = useCallback(() => {
    setSyncKey(getOrCreateDeviceId());
  }, []);

  useEffect(() => {
    refreshKey();
    window.addEventListener(HISTORY_SYNC_KEY_CHANGED_EVENT, refreshKey);
    return () => window.removeEventListener(HISTORY_SYNC_KEY_CHANGED_EVENT, refreshKey);
  }, [refreshKey]);

  const showNotice = (tone: "ok" | "err", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const copyKey = async () => {
    if (!syncKey) return;
    try {
      await navigator.clipboard.writeText(syncKey);
      showNotice("ok", "Sync key copied.");
    } catch {
      showNotice("err", "Could not copy — select and copy manually.");
    }
  };

  const applyPastedKey = () => {
    const result = setHistorySyncKey(paste);
    if (result.ok) {
      setPaste("");
      refreshKey();
      showNotice("ok", "This device now uses the same history as that key.");
    } else {
      showNotice("err", result.error);
    }
  };

  return (
    <Section title="History sync">
      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414]/80 p-3 space-y-3">
        <p className="text-[10px] text-[#666] leading-relaxed">
          Each browser starts with its own key. To see the same saved debates on your phone and Mac,
          open <span className="text-[#888]">Settings</span> here, copy the key, then paste it under
          History sync on the other device.
        </p>
        <p className="text-[10px] text-[#555] leading-relaxed">
          Anyone with this key can load or delete that history — treat it like a simple passphrase.
        </p>
        <div className="flex items-start gap-2">
          <code className="flex-1 min-w-0 break-all text-[10px] leading-snug text-[#AAA] bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg px-2 py-1.5 font-mono">
            {syncKey || "…"}
          </code>
          <button
            type="button"
            onClick={copyKey}
            disabled={!syncKey}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#2A2A2A] text-[11px] text-[#CCC]
                       hover:border-[#EF9F27]/40 hover:text-[#EF9F27] disabled:opacity-40 transition-colors"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
        <div className="flex flex-col gap-2 pt-1 border-t border-[#1A1A1A]">
          <span className="text-[10px] text-[#555] flex items-center gap-1.5">
            <Link2 size={11} className="text-[#444]" aria-hidden />
            Use key from another device
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste UUID here"
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg px-2.5 py-2 text-[11px] text-[#DDD] font-mono
                         placeholder-[#444] outline-none focus:border-[#EF9F27]/35"
            />
            <button
              type="button"
              onClick={applyPastedKey}
              disabled={!paste.trim()}
              className="shrink-0 px-3 py-2 rounded-lg bg-[#EF9F27]/15 border border-[#EF9F27]/35 text-[11px] font-semibold text-[#EF9F27]
                         hover:bg-[#EF9F27]/25 disabled:opacity-40 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
        {notice && (
          <p
            role="status"
            className={`text-[10px] leading-snug ${notice.tone === "ok" ? "text-emerald-400/90" : "text-red-400/90"}`}
          >
            {notice.text}
          </p>
        )}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#444] mb-3">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface ModelSelectProps {
  label: string;
  color: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

function ModelSelect({ label, color, value, options, onChange }: ModelSelectProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[12px] text-[#AAA] w-20 shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2 py-1.5
                   text-[11px] text-[#CCC] outline-none focus:border-[#3A3A3A]
                   appearance-none cursor-pointer"
        style={{ colorScheme: "dark" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ChipGroupProps<T extends string> {
  options: T[];
  value: T;
  color: string;
  onChange: (v: T) => void;
}

function ChipGroup<T extends string>({ options, value, color, onChange }: ChipGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all"
            style={{
              backgroundColor: active ? `${color}20` : "transparent",
              borderColor: active ? `${color}60` : "#2A2A2A",
              color: active ? color : "#555",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
