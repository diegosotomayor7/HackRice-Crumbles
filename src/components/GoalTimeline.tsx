"use client";

import { format, parseISO } from "date-fns";
import { Check, X } from "lucide-react";
import { useCalendarStore } from "@/lib/store";
import { isDone } from "@/lib/selectors";

// The timeline's date badge: month + day, stacked — same treatment CrumbReview uses so a
// goal's history reads consistently whether you're still refining it or looking back at it.
function DateBadge({ iso }: { iso: string }) {
  const d = parseISO(iso);
  return (
    <div className="relative z-10 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full bg-black text-white">
      <span className="text-[9px] leading-none font-medium tracking-wide uppercase">{format(d, "MMM")}</span>
      <span className="text-sm leading-none font-bold">{format(d, "d")}</span>
    </div>
  );
}

function formatWindow(start: string, end: string, allDay?: boolean) {
  if (allDay) return format(parseISO(start), "EEE, MMM d");
  return `${format(parseISO(start), "EEE, MMM d · h:mm a")} – ${format(parseISO(end), "h:mm a")}`;
}

// View of one long-term goal's whole plan, opened by tapping its progress bar on Home.
// Unlike CrumbReview (which this borrows its timeline layout from) there's no swipe-to-
// split or insert-a-step here — the one interaction is the per-step check button, which
// marks a step done/pending and feeds straight back into this goal's progress bar (and
// Home's, since both read the same isDone() over the same store).
export default function GoalTimeline({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const events = useCalendarStore((s) => s.events);
  const setTaskStatus = useCalendarStore((s) => s.setTaskStatus);
  const steps = events
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => a.start.localeCompare(b.start));

  const projectTitle = steps[0]?.projectTitle ?? projectId;
  const doneCount = steps.filter((e) => isDone(e)).length;
  const percent = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] flex-col bg-white">
      <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading truncate text-2xl leading-tight font-bold text-black">{projectTitle}</h2>
          <p className="text-sm text-black/60">
            {doneCount}/{steps.length} · {percent}% done
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black text-black hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="hide-scrollbar flex flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div className="relative flex flex-1 flex-col">
          {steps.length > 0 && <div className="absolute top-5 bottom-5 left-5 w-0.5 -translate-x-1/2 bg-black" />}

          {steps.map((step) => {
            const done = isDone(step);
            return (
              <div key={step.id} className={`flex items-center gap-3 py-1.5 ${done ? "opacity-50" : ""}`}>
                <DateBadge iso={step.start} />
                <div
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border-2 border-black p-4"
                  style={{ backgroundColor: step.color ?? "#ffffff" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-black">{step.title}</div>
                    <div className="text-xs text-black/60">{formatWindow(step.start, step.end, step.allDay)}</div>
                    {step.notes && <div className="mt-1 text-xs text-black/40">{step.notes}</div>}
                  </div>
                  <button
                    onClick={() => setTaskStatus(step.id, done ? "pending" : "done")}
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                    title={done ? "Mark as not done" : "Mark as done"}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-black ${
                      done ? "bg-accent-deep text-white" : "bg-white text-black/30 hover:text-black"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {steps.length === 0 && (
            <div className="flex flex-1 items-center justify-center text-sm text-black/40">
              No steps in this goal yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
