"use client";

import { useDebate } from "@/lib/debate-store";

export default function JudgeVerdict() {
  const { state } = useDebate();
  const v = state.judgeVerdict;
  if (!v) return null;

  return (
    <section
      className="mx-3 lg:mx-4 mb-4 rounded-2xl border-2 border-amber-500/45 bg-[#141414]/95 px-4 py-4 shadow-lg"
      aria-label="Judge verdict"
    >
      <h3 className="text-[15px] font-semibold text-amber-400 mb-4 tracking-tight">
        ⚖️ Judge&apos;s Verdict
      </h3>

      <VerdictBlock label="VERDICT" body={v.verdict} />
      <VerdictBlock label="REASONING" body={v.reasoning} />
      <VerdictBlock label="MVP" body={v.mvp} />
      <VerdictBlock label="DISSENT" body={v.dissent} />

      <div className="mt-5 pt-4 border-t border-[#2A2A2A]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#666] mb-2 text-center">
          RULING
        </p>
        <p className="text-[18px] leading-[1.65] text-[#F0F0F0] text-center italic font-medium">
          {v.ruling}
        </p>
      </div>
    </section>
  );
}

function VerdictBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#888] mb-1.5">
        {label}
      </p>
      <p className="text-[15px] text-[#D8D8D8] leading-[1.65]">{body}</p>
    </div>
  );
}
