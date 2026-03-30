import { type ModelId, MODEL_LABELS, MODEL_COLORS, normalizeLegacyDebaterModelId } from "@/lib/types";
import { getModelInitial } from "@/lib/debate-store";

interface TypingIndicatorProps {
  model: ModelId;
}

export default function TypingIndicator({ model }: TypingIndicatorProps) {
  const id = normalizeLegacyDebaterModelId(String(model));
  const color = MODEL_COLORS[id];
  const label = MODEL_LABELS[id];
  const initial = getModelInitial(id);

  return (
    <div className="flex gap-3 px-4 py-2">
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold text-white mt-0.5"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      <div className="flex flex-col justify-center gap-1">
        <span className="text-[13px] font-semibold" style={{ color }}>
          {label}
        </span>
        <div
          className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-tl-sm"
          style={{ backgroundColor: `${color}14`, border: `1px solid ${color}22` }}
        >
          <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}
