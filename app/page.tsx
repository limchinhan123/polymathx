"use client";

import { useRef, type TouchEvent } from "react";
import { useDebate } from "@/lib/debate-store";
import Header from "@/components/Header";
import TopicPill from "@/components/TopicPill";
import ChatThread from "@/components/ChatThread";
import DebateControls from "@/components/DebateControls";
import InputRow from "@/components/InputRow";
import SwipeHint from "@/components/SwipeHint";
import Drawer from "@/components/Drawer";
import ClarificationModal from "@/components/ClarificationModal";
import SummarySheet from "@/components/SummarySheet";

const SWIPE_THRESHOLD = 50; // px

export default function DebatePage() {
  const { dispatch } = useDebate();
  const touchStartX = useRef<number | null>(null);

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

  return (
    <div
      className="relative flex flex-col h-dvh w-full max-w-content mx-auto overflow-hidden bg-[#0A0A0A] swipe-area"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Fixed top */}
      <Header />
      <TopicPill />

      {/* Scrollable chat */}
      <ChatThread />

      {/* Bottom controls */}
      <DebateControls />
      <InputRow />
      <SwipeHint />

      {/* Overlays */}
      <Drawer />
      <ClarificationModal />
      <SummarySheet />
    </div>
  );
}
