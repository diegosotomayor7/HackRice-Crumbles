// Dumb presentational component — segmented progress bar for ExecutionScreen's header.
// One segment per step; done segments fill solid, the rest stay outlined.
export type ExecutionProgressBarProps = {
  total: number;
  doneCount: number;
};

export default function ExecutionProgressBar({ total, doneCount }: ExecutionProgressBarProps) {
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={
              "h-1.5 flex-1 rounded-full border border-black/70 transition-colors " +
              (i < doneCount ? "bg-accent-deep" : "bg-transparent")
            }
          />
        ))}
      </div>
      <span className="text-xs text-black/60">
        {doneCount}/{total} · {percent}% done
      </span>
    </div>
  );
}
