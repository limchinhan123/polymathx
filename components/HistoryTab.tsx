"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Clock, ChevronRight, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useDebate } from "@/lib/debate-store";
import {
  getOrCreateDeviceId,
  HISTORY_SYNC_KEY_CHANGED_EVENT,
} from "@/lib/device-id";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { normalizeLegacyDebaterModelId } from "@/lib/types";

function historyRowStatus(record: Doc<"debates">): "in_progress" | "complete" {
  if (record.summary) return "complete";
  if (record.status === "complete") return "complete";
  return "in_progress";
}

export default function HistoryTab() {
  const { newDebate, dispatch } = useDebate();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sheetRecord, setSheetRecord] = useState<Doc<"debates"> | null>(null);

  useEffect(() => {
    const sync = () => setDeviceId(getOrCreateDeviceId());
    sync();
    window.addEventListener(HISTORY_SYNC_KEY_CHANGED_EVENT, sync);
    return () => window.removeEventListener(HISTORY_SYNC_KEY_CHANGED_EVENT, sync);
  }, []);

  const debates = useQuery(
    api.debates.getDebates,
    deviceId ? { deviceId } : "skip"
  );

  const handleNewDebate = () => {
    newDebate();
    dispatch({ type: "CLOSE_DRAWER" });
  };

  const isLoading = deviceId !== null && debates === undefined;
  const isEmpty = debates !== undefined && debates.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#2A2A2A]">
        <button
          onClick={handleNewDebate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                     bg-[#EF9F27] text-black text-[13px] font-semibold
                     hover:bg-[#F5AB3A] active:scale-95 transition-all"
        >
          <Plus size={15} />
          New topic
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!deviceId || isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <Clock size={28} className="text-[#2A2A2A] animate-pulse" />
            <p className="text-sm text-[#444]">Loading history…</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
            <Clock size={28} className="text-[#2A2A2A]" />
            <p className="text-sm text-[#444]">No past sessions yet</p>
            <p className="text-xs text-[#333]">
              <span className="text-[#EF9F27]">X</span>
              <span>pand above — your history shows up here</span>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1A1A1A]">
            {debates!.map((record) => (
              <SwipeableHistoryRow
                key={record._id}
                record={record}
                onInProgressOpen={() => setSheetRecord(record)}
              />
            ))}
          </ul>
        )}
      </div>

      {sheetRecord && (
        <InProgressDebateSheet
          record={sheetRecord}
          onClose={() => setSheetRecord(null)}
          onStartNew={() => {
            newDebate();
            setSheetRecord(null);
            dispatch({ type: "CLOSE_DRAWER" });
          }}
        />
      )}
    </div>
  );
}

function InProgressDebateSheet({
  record,
  onClose,
  onStartNew,
}: {
  record: Doc<"debates">;
  onClose: () => void;
  onStartNew: () => void;
}) {
  const roundN = Math.max(0, record.rounds);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/60" role="dialog">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className="relative max-h-[85dvh] flex flex-col rounded-t-2xl border-t border-x border-[#2A2A2A] bg-[#0A0A0A] shadow-xl"
        style={{ margin: "0 auto", width: "100%", maxWidth: "min(100%, 520px)" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A]">
          <p className="text-[13px] text-[#CCC] font-medium truncate pr-2">{record.topic}</p>
          <button
            type="button"
            aria-label="Close sheet"
            onClick={onClose}
            className="shrink-0 p-2 rounded-lg text-[#666] hover:text-white hover:bg-[#1A1A1A]"
          >
            <X size={18} />
          </button>
        </div>
        <p className="px-4 pt-3 text-[12px] text-amber-500/90">
          Debate interrupted at Round {roundN || 1}
        </p>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
          {record.messages.map((m) => {
            const label =
              m.isModerator === true
                ? "Moderator"
                : MODEL_LABEL_SHORT[normalizeLegacyDebaterModelId(m.model)] ?? m.model;
            return (
              <div key={m.id} className="text-[13px]">
                <p className="text-[10px] uppercase tracking-wider text-[#555] mb-1">
                  {label}
                  {m.round > 0 ? ` · R${m.round}` : ""}
                </p>
                <p className="text-[#CCC] whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-[#1A1A1A] shrink-0">
          <button
            type="button"
            onClick={onStartNew}
            className="w-full py-3 rounded-xl bg-[#EF9F27] text-black text-[14px] font-semibold
                       hover:bg-[#f0a832] active:scale-[0.99] transition-all"
          >
            Start New Debate
          </button>
        </div>
      </div>
    </div>
  );
}

const MODEL_LABEL_SHORT: Record<string, string> = {
  claude: "Claude",
  gpt4o: "GPT-4o",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  blackHat: "R1",
};

function SwipeableHistoryRow({
  record,
  onInProgressOpen,
}: {
  record: Doc<"debates">;
  onInProgressOpen: () => void;
}) {
  const { loadSavedDebate } = useDebate();
  const deleteDebate = useMutation(api.debates.deleteDebate);
  const [dx, setDx] = useState(0);
  const originX = useRef(0);
  const dragging = useRef(false);
  const startClientX = useRef(0);
  const hasDraggedHorizontally = useRef(false);

  const rowState = historyRowStatus(record);

  const onDelete = useCallback(async () => {
    try {
      await deleteDebate({ id: record._id });
    } catch (e) {
      console.error("Failed to delete debate", e);
    }
  }, [deleteDebate, record._id]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    hasDraggedHorizontally.current = false;
    startClientX.current = e.clientX;
    originX.current = e.clientX - dx;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    if (Math.abs(e.clientX - startClientX.current) > 12) {
      hasDraggedHorizontally.current = true;
    }
    const next = e.clientX - originX.current;
    setDx(Math.min(0, Math.max(-120, next)));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragging.current) {
      dragging.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (dx < -72) {
      void onDelete();
    }
    setDx(0);
  };

  const onRowActivate = () => {
    if (hasDraggedHorizontally.current) {
      hasDraggedHorizontally.current = false;
      return;
    }
    if (rowState === "in_progress") {
      onInProgressOpen();
      return;
    }
    loadSavedDebate(record);
  };

  const date = new Date(record.createdAt);
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const messageCount = record.messages.length;
  const rounds = record.rounds;

  return (
    <li className="relative overflow-hidden touch-pan-y">
      <div
        className="absolute inset-y-0 right-0 w-[88px] flex items-center justify-center bg-[#5c1515] text-[#f5a3a3]"
        aria-hidden
      >
        <Trash2 size={18} />
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={onRowActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRowActivate();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ transform: `translateX(${dx}px)` }}
        className="relative flex items-center gap-3 px-4 py-3 bg-[#0A0A0A] hover:bg-[#141414] transition-colors cursor-pointer group select-none"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-[#CCC] truncate font-medium">{record.topic}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-[#444]">
              {dateLabel} · {timeLabel}
            </span>
            <span className="text-[10px] text-[#333]">·</span>
            <span className="text-[10px] text-[#444]">
              {rounds} round{rounds !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-[#333]">·</span>
            <span className="text-[10px] text-[#444]">{messageCount} msgs</span>
            {rowState === "in_progress" ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-500/95 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Round {rounds} · In Progress
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500/90 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                {rounds} Rounds · Complete
              </span>
            )}
          </div>
        </div>
        <ChevronRight size={14} className="text-[#333] group-hover:text-[#555] transition-colors shrink-0" />
      </div>
    </li>
  );
}
