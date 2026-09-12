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
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}
