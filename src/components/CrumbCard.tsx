"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { format, parseISO } from "date-fns";
import { Check, Split, Loader2 } from "lucide-react";
import { DraftCrumb } from "@/types/event";

const SWIPE_THRESHOLD = 110;

// Just the time-of-day — the date itself lives in the timeline circle CrumbReview
// renders next to this card, so repeating it here would be redundant.
function formatWindow(crumb: DraftCrumb) {
  if (crumb.allDay) return "All day";
  const start = parseISO(crumb.start);
  const end = parseISO(crumb.end);
  return `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
}

export default function CrumbCard({
  crumb,
  onCommit,
  onSplit,
  splitBlocked,
}: {
  crumb: DraftCrumb;
  onCommit: () => void;
  onSplit: () => Promise<boolean>;
  splitBlocked: boolean;
}) {
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const x = useMotionValue(0);
  const rightHint = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const leftHint = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  const runCommit = () => {
    setCommitting(true);
    onCommit();
  };

  const runSplit = async () => {
    if (splitBlocked || splitting) return;
    setSplitError(null);
    setSplitting(true);
    const ok = await onSplit();
    if (!ok) {
      setSplitting(false);
      setSplitError(splitBlocked ? "Max 8 cards — add some to your calendar first." : "Couldn't split that. Try again.");
    }
    // On success the card is removed by the parent re-render; no need to reset state.
  };

  return (
    <div className="relative">
      {/* Background hints revealed as the card is dragged. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-xl px-5">
        <motion.div style={{ opacity: leftHint }} className="flex items-center gap-1.5 text-tan">
          <Split className="h-5 w-5" />
          <span className="text-sm font-medium">Split</span>
        </motion.div>
        <motion.div style={{ opacity: rightHint }} className="flex items-center gap-1.5 text-accent-deep">
          <span className="text-sm font-medium">Add to calendar</span>
          <Check className="h-5 w-5" />
        </motion.div>
      </div>

      <motion.div
        layout
        style={{ x, backgroundColor: crumb.color ?? "#ffffff" }}
        drag={splitting || committing ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={(_, info) => {
          if (info.offset.x >= SWIPE_THRESHOLD) {
            runCommit();
          } else if (info.offset.x <= -SWIPE_THRESHOLD) {
            runSplit();
          }
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={splitting ? { opacity: 0.55, scale: 0.97 } : { opacity: 1, scale: 1 }}
        exit={
          committing
            ? { x: 400, opacity: 0, transition: { duration: 0.2 } }
            : { opacity: 0, scale: 0.85, transition: { duration: 0.15 } }
        }
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className="relative flex items-center justify-between gap-3 rounded-xl border-2 border-black p-4 shadow-sm active:cursor-grabbing"
      >
        <div className="min-w-0">
          {crumb.projectTitle && crumb.projectTitle !== crumb.title && (
            <div className="truncate text-xs font-medium text-accent-deep">{crumb.projectTitle}</div>
          )}
          <div className="truncate font-medium text-black">{crumb.title}</div>
          <div className="text-xs text-black/60">{formatWindow(crumb)}</div>
          {crumb.notes && <div className="mt-1 text-xs text-black/40">{crumb.notes}</div>}
          {splitError && <div className="mt-1 text-xs text-red-500">{splitError}</div>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={runSplit}
            disabled={splitting || splitBlocked || committing}
            title={splitBlocked ? "Max 8 cards reached" : "Too big — split into two"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-black/20 text-tan disabled:opacity-30"
          >
            {splitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Split className="h-4 w-4" />}
          </button>
          <button
            onClick={runCommit}
            disabled={splitting || committing}
            title="Add to calendar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-deep text-white disabled:opacity-30"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
