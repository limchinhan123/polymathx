"use client";

import { useDebate } from "@/lib/debate-store";
import { ChevronLeft } from "lucide-react";

export default function SwipeHint() {
  const { state } = useDebate();

  if (state.drawerOpen) return null;

  return (
    <div className="lg:hidden flex items-center justify-end px-4 py-1 shrink-0 pointer-events-none">
      <span className="flex items-center gap-0.5 text-[11px] text-[#3A3A3A]">
        <ChevronLeft size={10} />
        swipe for your history
      </span>
    </div>
  );
}
