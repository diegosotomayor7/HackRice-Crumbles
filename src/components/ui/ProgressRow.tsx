export default function ProgressRow({
  title,
  label,
  progress,
}: {
  title: string;
  label: string;
  progress: number;
}) {
  const pct = Math.min(100, Math.max(0, progress));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{title}</span>
      {/* Bordered pill whose fill is a gradient stopping exactly at the percent done —
          the Homepage UI design's progress bar treatment, done with one gradient instead
          of a resized inner div. */}
      <div
        className="h-[10px] w-full rounded-full border border-ink/70"
        style={{
          background: `linear-gradient(to right, var(--color-accent-deep) 0%, var(--color-accent) ${pct}%, transparent ${pct}%, transparent 100%)`,
        }}
      />
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}
