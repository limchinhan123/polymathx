"use client";

import { useDebate } from "@/lib/debate-store";
import HistoryTab from "./HistoryTab";
import SettingsTab from "./SettingsTab";

/** Fixed left rail on lg+ — history / settings without overlay drawer. */
export default function DesktopSidebar() {
  const { state, dispatch } = useDebate();
  const { drawerTab } = state;

  return (
    <aside
      className="hidden lg:flex w-[320px] shrink-0 flex-col border-r border-[#2A2A2A] bg-[#0A0A0A] h-full min-h-0"
      aria-label="Debate sidebar"
    >
      <div className="flex border-b border-[#2A2A2A] shrink-0">
        {(["history", "settings"] as const).map((tab) => {
          const active = drawerTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => dispatch({ type: "SET_DRAWER_TAB", payload: tab })}
              className="flex-1 py-3 text-[14px] font-medium capitalize transition-colors relative"
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
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {drawerTab === "history" ? <HistoryTab /> : <SettingsTab />}
      </div>
    </aside>
  );
}
