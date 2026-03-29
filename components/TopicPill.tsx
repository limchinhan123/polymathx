"use client";

import { MessageSquare } from "lucide-react";
import { useDebate } from "@/lib/debate-store";

export default function TopicPill() {
  const { state } = useDebate();

  if (!state.topic || state.status === "idle") return null;

  return (
    <div className="px-4 py-2 shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#141414] border border-[#2A2A2A] max-w-full">
        <MessageSquare size={12} className="text-[#EF9F27] shrink-0" />
        <p className="text-xs text-[#999] truncate flex-1 min-w-0">{state.topic}</p>
      </div>
    </div>
  );
}
