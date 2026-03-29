interface RoundDividerProps {
  round: number;
}

export default function RoundDivider({ round }: RoundDividerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 shrink-0">
      <div className="flex-1 h-px bg-[#2A2A2A]" />
      <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#EF9F27] opacity-70 whitespace-nowrap">
        Round {round}
      </span>
      <div className="flex-1 h-px bg-[#2A2A2A]" />
    </div>
  );
}
