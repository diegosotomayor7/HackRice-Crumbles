"use client";

import { motion, useMotionValue, useTransform } from "motion/react";
import { Check, Split } from "lucide-react";
import { CalendarEvent } from "@/types/event";
import { durationMinutes } from "@/lib/selectors";

const SWIPE_THRESHOLD = 110;

// Dumb presentational card for ExecutionScreen. `peek` renders a smaller, non-interactive
// preview (the upcoming-steps stack behind the current card); only the front (non-peek)
// card is draggable. `highlighted` is a brief ring shown right after the agent adds/edits
// this exact card, so the "reply IS a task-list change" mechanic reads clearly on screen.
export type StepCardProps = {
  task: CalendarEvent;
  stepNumber: number;
  totalSteps: number;
  peek?: boolean;
  highlighted?: boolean;
  busy?: boolean;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
};

export default function StepCard({
  task,
  stepNumber,
  totalSteps,
  peek = false,
  highlighted = false,
  busy = false,
  onSwipeRight,
  onSwipeLeft,
}: StepCardProps) {
  const x = useMotionValue(0);
  const rightHint = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const leftHint = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  if (peek) {
    return (
      <div className="absolute inset-x-3 top-3 -z-10 flex flex-col gap-2 rounded-card border-2 border-black/20 bg-white/70 p-5 opacity-60">
        <span className="text-xs font-medium text-black/40">STEP {stepNumber}/{totalSteps}</span>
        <span className="truncate text-base font-semibold text-black/50">{task.title}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between rounded-card px-6">
        <motion.div style={{ opacity: leftHint }} className="flex items-center gap-1.5 text-tan">
          <Split className="h-5 w-5" />
          <span className="text-sm font-medium">Break it down</span>
        </motion.div>
        <motion.div style={{ opacity: rightHint }} className="flex items-center gap-1.5 text-accent-deep">
          <span className="text-sm font-medium">Done</span>
          <Check className="h-5 w-5" />
        </motion.div>
      </div>

      <motion.div
        layout
        style={{ x }}
        drag={busy ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={(_, info) => {
          if (info.offset.x >= SWIPE_THRESHOLD) onSwipeRight?.();
          else if (info.offset.x <= -SWIPE_THRESHOLD) onSwipeLeft?.();
        }}
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{
          opacity: busy ? 0.6 : 1,
          scale: 1,
          y: 0,
          boxShadow: highlighted
            ? "0 0 0 3px var(--color-accent-deep)"
            : "0 4px 20px -6px color-mix(in srgb, var(--color-ink) 25%, transparent)",
        }}
        exit={{ x: 400, opacity: 0, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 400, damping: 32 }}
        className="relative flex min-h-[220px] flex-col justify-between gap-4 rounded-card border-2 border-black bg-white p-6 active:cursor-grabbing"
      >
        <div>
          <span className="text-xs font-bold tracking-wide text-black/40">
            STEP {stepNumber}/{totalSteps}
          </span>
          <h2 className="font-heading mt-1 text-2xl leading-tight font-bold text-black">{task.title}</h2>
          {task.notes && <p className="mt-2 text-sm text-black/60">{task.notes}</p>}
        </div>
        <span className="text-sm font-medium text-black/50">~{durationMinutes(task)} min</span>
      </motion.div>
    </div>
  );
}
