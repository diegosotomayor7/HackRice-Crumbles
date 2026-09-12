"use client";

import { Share2 } from "lucide-react";
import Card from "@/components/ui/Card";
import { useCalendarStore } from "@/lib/store";
import { weeklyStats } from "@/lib/selectors";

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function StatRow({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
        <img src={icon} alt="" className="h-9 w-9 object-contain" />
      </div>
      <div>
        <p className="text-lg font-bold text-black">{value}</p>
        <p className="text-sm text-black/60">{label}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const events = useCalendarStore((s) => s.events);
  const stats = weeklyStats(events);
  const hoursFocused = (stats.minutesSpent / 60).toFixed(1);
  const progress = stats.longtermProgressChangePercent;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading truncate text-2xl font-bold text-black">My Crumbs</h1>
          <p className="text-sm text-black/60">Crumb is so proud of you!</p>
        </div>
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-surface">
          <img src="/mascot/profile-avatar.png" alt="" className="h-full w-full object-cover" />
        </div>
      </div>

      <Card className="relative flex flex-col gap-4 overflow-hidden bg-gradient-to-b from-white to-accent p-4 pb-28">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-jersey min-w-0 flex-1 text-3xl leading-tight text-black">
            Here&apos;s what you&apos;ve done!
          </h2>
          <button className="flex shrink-0 items-center gap-1 rounded-full border-2 border-black bg-white px-3 py-1.5 text-sm font-medium text-black hover:opacity-90">
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>

        <p className="text-sm text-black/60">
          {dateFormatter.format(stats.weekStart)} - {dateFormatter.format(stats.weekEnd)}
        </p>

        <div className="flex flex-col gap-3">
          <StatRow icon="/mascot/stat-steps.png" value={String(stats.tasksCompleted)} label="Steps taken" />
          <StatRow icon="/mascot/stat-focus.png" value={hoursFocused} label="hours focused" />
          <StatRow
            icon="/mascot/stat-growth.png"
            value={`${progress >= 0 ? "+" : ""}${progress}%`}
            label="Progress on long term goal"
          />
        </div>

        <img
          src="/mascot/profile-hero.png"
          alt=""
          className="pointer-events-none absolute bottom-3 left-3 h-28 w-28 object-contain"
        />
      </Card>
    </div>
  );
}
