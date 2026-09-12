"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// Sits between two adjacent cards in the review stack. Opens a small modal so the user
// can type in the one task that's missing between the two neighboring cards, using the
// gap between them (prev.end -> next.start) as the new crumb's time slot.
export default function InsertGapButton({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: (title: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openModal = () => {
    if (disabled) return;
    setTitle("");
    setError(null);
    setOpen(true);
  };

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const ok = onInsert(trimmed);
    if (ok) {
      setOpen(false);
    } else {
      setError(disabled ? "Max cards reached." : "No time gap to insert into there.");
    }
  };

  return (
    <div className="relative -my-1.5 flex items-center justify-center py-1.5">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/10 dark:bg-white/10" />
      <button
        onClick={openModal}
        disabled={disabled}
        title={disabled ? "Max cards reached" : "Insert a step here"}
        className="relative flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-neutral-50 text-neutral-400 opacity-60 transition-opacity hover:border-indigo-400 hover:text-indigo-500 hover:opacity-100 disabled:opacity-30 dark:border-white/10 dark:bg-neutral-950"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-xl bg-white p-4 shadow-xl dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Insert a step</h3>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="What's the new task?"
              className="w-full rounded-lg border border-black/10 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-100"
            />
            {error && <div className="mt-1.5 text-xs text-red-500">{error}</div>}
            <button
              onClick={submit}
              disabled={!title.trim()}
              className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Add task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
