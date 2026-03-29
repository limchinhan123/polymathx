"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useDebate } from "@/lib/debate-store";
import HistoryTab from "./HistoryTab";
import SettingsTab from "./SettingsTab";

export default function Drawer() {
  const { state, dispatch } = useDebate();
  const { drawerOpen, drawerTab } = state;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "CLOSE_DRAWER" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen, dispatch]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop animate-fade-in"
        onClick={() => dispatch({ type: "CLOSE_DRAWER" })}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-[#0F0F0F] border-l border-[#2A2A2A] animate-slide-in"
        style={{ width: "82%" }}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#2A2A2A] shrink-0">
          <h2 className="text-[14px] font-semibold text-white">Menu</h2>
          <button
            onClick={() => dispatch({ type: "CLOSE_DRAWER" })}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#666] hover:text-white hover:bg-[#1A1A1A] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2A2A2A] shrink-0">
          {(["history", "settings"] as const).map((tab) => {
            const active = drawerTab === tab;
            return (
              <button
                key={tab}
                onClick={() => dispatch({ type: "SET_DRAWER_TAB", payload: tab })}
                className="flex-1 py-3 text-[12px] font-medium capitalize transition-colors relative"
                style={{ color: active ? "#EF9F27" : "#555" }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#EF9F27]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {drawerTab === "history" ? <HistoryTab /> : <SettingsTab />}
        </div>
      </aside>
    </>
  );
}
