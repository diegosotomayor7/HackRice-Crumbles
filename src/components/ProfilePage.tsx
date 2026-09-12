"use client";

import Card from "@/components/ui/Card";
import { useCalendarStore } from "@/lib/store";
import { weeklyStats } from "@/lib/selectors";

// Placeholder scaffold — teammate is designing the real layout in Figma. The numbers
// below are wired to real data so the layout can be swapped in without redoing the stats.
const USER_NAME = "User";

export default function ProfilePage() {
  const events = useCalendarStore((s) => s.events);
  const stats = weeklyStats(events);
  const hoursSpent = (stats.minutesSpent / 60).toFixed(1);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface">
          <img src="/mascot/avatar.png" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading truncate text-lg font-semibold text-ink">{USER_NAME}</h1>
          <p className="text-sm text-ink-muted">Profile</p>
        </div>
      </div>

      <Card className="flex flex-col gap-2 p-4 text-sm text-ink">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Tasks completed this week</span>
          <span className="font-semibold">
            {stats.tasksCompleted}
            {stats.tasksCompletedChangePercent !== null && (
              <span className={stats.tasksCompletedChangePercent >= 0 ? "text-emerald-600" : "text-red-500"}>
                {" "}
                ({stats.tasksCompletedChangePercent >= 0 ? "+" : ""}
                {stats.tasksCompletedChangePercent}%)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">Hours spent this week</span>
          <span className="font-semibold">{hoursSpent}</span>
        </div>
      </Card>
    </div>
  );
}
