"use client";

import { AnimatePresence } from "motion/react";
import { X, CalendarPlus } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <h2 className="font-semibold">Refine your plan</h2>
          <p className="text-xs text-neutral-500">
            Swipe right to add a card to your calendar, left if it&apos;s still too big. Tap the + between two cards
            to insert a step.
          </p>
        </div>
        <button
          onClick={discardReview}
          title="Discard without adding to calendar"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-3 overflow-y-auto p-4">
        {atCap && (
          <div className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Max {MAX_DRAFT_CRUMBS} cards reached — add some to your calendar to split further.
          </div>
        )}
        <AnimatePresence initial={false}>
          {sorted.flatMap((crumb, i) => {
            const card = (
              <CrumbCard
                key={crumb.id}
                crumb={crumb}
                splitBlocked={atCap}
                onCommit={() => commitDraftCrumb(crumb.id)}
                onSplit={() => split(crumb)}
              />
            );
            if (i === 0) return [card];
            const prev = sorted[i - 1];
            const gap = (
              <InsertGapButton
                key={`gap-${prev.id}-${crumb.id}`}
                disabled={atCap}
                onInsert={() => insertBetween(prev, crumb)}
              />
            );
            return [gap, card];
          })}
        </AnimatePresence>
        {sorted.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">All done!</div>
        )}
      </div>

      <div className="border-t border-black/10 p-4 dark:border-white/10">
        <button
          onClick={commitAllDraftCrumbs}
          disabled={draftCrumbs.length === 0}
          className="mx-auto flex w-full max-w-[480px] items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-medium text-white disabled:opacity-40"
        >
          <CalendarPlus className="h-4 w-4" />
          Add all {draftCrumbs.length > 0 ? `${draftCrumbs.length} ` : ""}to calendar
        </button>
      </div>
    </div>
  );
}
