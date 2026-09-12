"use client";

import { useCalendarStore } from "@/lib/store";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

export default function CrumbStack() {
  const events = useCalendarStore((s) => s.events);

  const upcoming = [...events]
    .filter((e) => new Date(e.end) >= new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3);

  if (upcoming.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-white p-4 text-center text-sm text-neutral-400 dark:border-white/10 dark:bg-neutral-900">
        Nothing coming up. Tell the chat about a goal to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {upcoming.map((crumb) => (
        <div
          key={crumb.id}
          className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: crumb.color ?? "#6366f1" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{crumb.title}</p>
            {crumb.projectTitle && (
              <p className="truncate text-xs text-neutral-400">{crumb.projectTitle}</p>
            )}
          </div>
          <span className="shrink-0 text-xs text-neutral-400">
            {crumb.allDay ? "All day" : timeFormatter.format(new Date(crumb.start))}
          </span>
        </div>
      ))}
    </div>
  );
}
