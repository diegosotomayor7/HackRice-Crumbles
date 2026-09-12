"use client";

import { AnimatePresence } from "motion/react";
import { format, parseISO } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { useCalendarStore, MAX_DRAFT_CRUMBS } from "@/lib/store";
import { DraftCrumb } from "@/types/event";
import CrumbCard from "./CrumbCard";
import InsertGapButton from "./InsertGapButton";

function clientNowLabel() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(
    now.getMinutes()
  )}:${pad(now.getSeconds())}`;
}

// The timeline's date badge: month + day, stacked. The card itself only shows the
// time-of-day (see CrumbCard#formatWindow) so the date lives in exactly one place.
function DateBadge({ iso }: { iso: string }) {
  const d = parseISO(iso);
  return (
    <div className="relative z-10 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full bg-black text-white">
      <span className="text-[9px] leading-none font-medium tracking-wide uppercase">{format(d, "MMM")}</span>
      <span className="text-sm leading-none font-bold">{format(d, "d")}</span>
    </div>
  );
}

// Full-screen takeover shown after the AI hands back a goal card (isGoalBreakdown).
// The user — not the AI — decides how many subtasks exist by swiping left (split)
// or right (commit) on each card, until they're happy and hit "Add to calendar".
export default function CrumbReview() {
  const draftCrumbs = useCalendarStore((s) => s.draftCrumbs);
  const commitDraftCrumb = useCalendarStore((s) => s.commitDraftCrumb);
  const commitAllDraftCrumbs = useCalendarStore((s) => s.commitAllDraftCrumbs);
  const splitDraftCrumb = useCalendarStore((s) => s.splitDraftCrumb);
  const insertDraftCrumb = useCalendarStore((s) => s.insertDraftCrumb);
  const discardReview = useCalendarStore((s) => s.discardReview);

  // Soonest first — the card you'd act on next sits at the top.
  const sorted = [...draftCrumbs].sort((a, b) => a.start.localeCompare(b.start));
  const atCap = draftCrumbs.length >= MAX_DRAFT_CRUMBS;
  const goalTitle = sorted[0]?.projectTitle ?? "Your plan";

  const split = async (crumb: DraftCrumb) => {
    if (draftCrumbs.length >= MAX_DRAFT_CRUMBS) return false;
    try {
      const res = await fetch("/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crumb: {
            title: crumb.title,
            start: crumb.start,
            end: crumb.end,
            allDay: crumb.allDay,
            notes: crumb.notes,
            projectTitle: crumb.projectTitle,
            depth: crumb.depth,
          },
          clientNow: clientNowLabel(),
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        crumbs: { title: string; start: string; end: string; allDay?: boolean; notes?: string }[];
      };
      if (data.crumbs?.length !== 2) return false;
      const children = data.crumbs.map((c) => ({
        id: crypto.randomUUID(),
        title: c.title,
        start: c.start,
        end: c.end,
        allDay: c.allDay ?? false,
        notes: c.notes,
        projectId: crumb.projectId,
        projectTitle: crumb.projectTitle,
        color: crumb.color,
        depth: crumb.depth + 1,
      })) as [DraftCrumb, DraftCrumb];
      return splitDraftCrumb(crumb.id, children);
    } catch {
      return false;
    }
  };

  const insertBetween = async (prev: DraftCrumb, next: DraftCrumb) => {
    if (draftCrumbs.length >= MAX_DRAFT_CRUMBS) return false;
    try {
      const res = await fetch("/api/insert-crumb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prev: { title: prev.title, start: prev.start, end: prev.end, allDay: prev.allDay, notes: prev.notes },
          next: { title: next.title, start: next.start, end: next.end, allDay: next.allDay, notes: next.notes },
          projectTitle: prev.projectTitle ?? next.projectTitle,
          clientNow: clientNowLabel(),
        }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        crumb?: { title: string; start: string; end: string; allDay?: boolean; notes?: string };
      };
      if (!data.crumb) return false;
      const inserted: DraftCrumb = {
        id: crypto.randomUUID(),
        title: data.crumb.title,
        start: data.crumb.start,
        end: data.crumb.end,
        allDay: data.crumb.allDay ?? false,
        notes: data.crumb.notes,
        projectId: prev.projectId ?? next.projectId,
        projectTitle: prev.projectTitle ?? next.projectTitle,
        color: prev.color ?? next.color,
        depth: Math.max(prev.depth, next.depth),
      };
      return insertDraftCrumb(inserted);
    } catch {
      return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] flex-col bg-white">
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <h2 className="font-heading min-w-0 flex-1 text-2xl leading-tight font-bold text-black">{goalTitle}</h2>
        <button
          onClick={discardReview}
          title="Discard without adding to calendar"
          className="shrink-0 rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Back
        </button>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4">
        {atCap && (
          <div className="mb-3 rounded-lg border border-tan bg-tan/20 px-3 py-2 text-xs text-black">
            Max {MAX_DRAFT_CRUMBS} cards reached — add some to your calendar to split further.
          </div>
        )}

        <div className="relative flex flex-1 flex-col">
          {/* Timeline spine, running through the center of every date circle below. */}
          {sorted.length > 0 && <div className="absolute top-5 bottom-5 left-5 w-0.5 -translate-x-1/2 bg-black" />}

          <AnimatePresence initial={false}>
            {sorted.flatMap((crumb, i) => {
              const row = (
                <div key={crumb.id} className="flex items-center gap-3 py-1.5">
                  <DateBadge iso={crumb.start} />
                  <div className="min-w-0 flex-1">
                    <CrumbCard
                      crumb={crumb}
                      splitBlocked={atCap}
                      onCommit={() => commitDraftCrumb(crumb.id)}
                      onSplit={() => split(crumb)}
                    />
                  </div>
                </div>
              );
              if (i === 0) return [row];
              const prev = sorted[i - 1];
              const gap = (
                <div key={`gap-${prev.id}-${crumb.id}`} className="flex items-center gap-3">
                  <InsertGapButton disabled={atCap} onInsert={() => insertBetween(prev, crumb)} />
                </div>
              );
              return [gap, row];
            })}
          </AnimatePresence>

          {sorted.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-sm text-black/40">All done!</div>
          )}
        </div>
      </div>

      <div className="border-t-2 border-black p-4">
        <button
          onClick={commitAllDraftCrumbs}
          disabled={draftCrumbs.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-black bg-accent py-3 font-bold text-black disabled:opacity-40"
        >
          <CalendarPlus className="h-4 w-4" />
          Add all {draftCrumbs.length > 0 ? `${draftCrumbs.length} ` : ""}to calendar
        </button>
      </div>
    </div>
  );
}
