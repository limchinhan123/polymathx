"use client";

import { useState, useEffect, type FormEvent } from "react";
import { clearIdleSuggestionsCache } from "@/lib/idle-suggestions";

const STORAGE_KEY = "pmx_access";
const PASSWORD = process.env.NEXT_PUBLIC_ACCESS_PASSWORD ?? "";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // No password configured → let everyone through
    if (!PASSWORD) {
      setUnlocked(true);
      setReady(true);
      return;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === PASSWORD) setUnlocked(true);
    setReady(true);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (input === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, PASSWORD);
      clearIdleSuggestionsCache();
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  }

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0A] z-50 px-6">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        {/* Logo / wordmark */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <span className="text-2xl font-bold tracking-tight text-white">
            Polymath<span className="text-[#EF9F27]">X</span>
          </span>
          <span className="text-xs text-white/40">Private access</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`w-full flex flex-col gap-3 ${shake ? "animate-shake" : ""}`}
        >
          <input
            autoFocus
            type="password"
            placeholder="Enter password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            className={`w-full bg-[#141414] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#EF9F27]/60 ${
              error ? "border-red-500/70" : "border-[#2A2A2A]"
            }`}
          />
          {error && (
            <p className="text-xs text-red-400 text-center -mt-1">Incorrect password</p>
          )}
          <button
            type="submit"
            className="w-full bg-[#EF9F27] text-black font-semibold text-sm rounded-xl py-3 hover:bg-[#EF9F27]/90 active:scale-[0.98] transition-all"
          >
            Enter
          </button>
        </form>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
