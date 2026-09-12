"use client";

import { useCalendarStore } from "@/lib/store";
import Card from "@/components/ui/Card";

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
      <Card className="p-4 text-center text-sm text-ink-muted">
        Nothing coming up. Tell the chat about a goal to get started.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {upcoming.map((crumb) => (
        <Card key={crumb.id} className="flex items-center gap-3 p-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: crumb.color ?? "#e2b06b" }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{crumb.title}</p>
            {crumb.projectTitle && (
              <p className="truncate text-xs text-ink-muted">{crumb.projectTitle}</p>
            )}
          </div>
          <span className="shrink-0 text-xs text-ink-muted">
            {crumb.allDay ? "All day" : timeFormatter.format(new Date(crumb.start))}
          </span>
        </Card>
      ))}
    </div>
  );
}
