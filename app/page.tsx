"use client";

import { useRef, useEffect, useState, type TouchEvent } from "react";
import { useDebate, readFreshSessionDebateTopic } from "@/lib/debate-store";
import Header from "@/components/Header";
import TopicPill from "@/components/TopicPill";
import ChatThread from "@/components/ChatThread";
import DebateControls from "@/components/DebateControls";
import InputRow from "@/components/InputRow";
import SwipeHint from "@/components/SwipeHint";
import Drawer from "@/components/Drawer";
import DesktopSidebar from "@/components/DesktopSidebar";
import ClarificationModal from "@/components/ClarificationModal";
import SummarySheet from "@/components/SummarySheet";

const SWIPE_THRESHOLD = 50; // px

export default function DebatePage() {
  const { dispatch, state } = useDebate();
  const touchStartX = useRef<number | null>(null);
  const [restoreToast, setRestoreToast] = useState<string | null>(null);
  const kfInjected = useRef(false);

  useEffect(() => {
    if (!kfInjected.current && typeof document !== "undefined") {
      kfInjected.current = true;
      const id = "polymath-restore-toast-kf";
      if (!document.getElementById(id)) {
        const style = document.createElement("style");
        style.id = id;
        style.textContent = `@keyframes polymathRestoreFadeOut { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }`;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    const topic = readFreshSessionDebateTopic();
    if (!topic) return;
    const snippet = topic.length > 30 ? `${topic.slice(0, 30)}...` : topic;
    setRestoreToast(`Debate restored · ${snippet}`);
    const t = window.setTimeout(() => setRestoreToast(null), 3000);
    return () => window.clearTimeout(t);
  }, []);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > SWIPE_THRESHOLD) {
      dispatch({ type: "OPEN_DRAWER", payload: "history" });
    }
    touchStartX.current = null;
  };

  const toastLine = state.toast ?? restoreToast;
  const useRestoreAnimation = Boolean(restoreToast && !state.toast);

  return (
    <div
      className="relative flex flex-col h-dvh w-full max-w-content md:max-w-tablet lg:max-w-shell mx-auto overflow-hidden bg-[#0A0A0A] swipe-area"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {toastLine && (
        <div
          role="status"
          className="pointer-events-none"
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1A1A1C",
            border: "0.5px solid #EF9F27",
            color: "#EF9F27",
            fontSize: "13px",
            padding: "8px 16px",
            borderRadius: "20px",
            zIndex: 100,
            maxWidth: "min(92vw, 360px)",
            textAlign: "center",
            animation: useRestoreAnimation ? "polymathRestoreFadeOut 3s forwards" : "none",
            boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
          }}
        >
          {toastLine}
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row w-full">
        <DesktopSidebar />

        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <Header />
          <TopicPill />
          <ChatThread />
          <DebateControls />
          <InputRow />
          <SwipeHint />
        </div>
      </div>

      <Drawer />
      <ClarificationModal />
      <SummarySheet />
    </div>
  );
}
