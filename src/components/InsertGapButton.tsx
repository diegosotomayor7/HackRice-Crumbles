"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// Sits between two adjacent cards in the review stack, in the same left-hand column as
// the timeline's date circles (CrumbReview positions it there) so it reads as a stop on
// the same line. Opens a small modal so the user can type in the one task that's missing
// between the two neighboring cards, using the gap between them (prev.end -> next.start)
// as the new crumb's time slot.
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
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <button
        onClick={openModal}
        disabled={disabled}
        title={disabled ? "Max cards reached" : "Insert a step here"}
        className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-white text-black transition-transform hover:scale-110 disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[360px] rounded-xl border-2 border-black bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-black">Insert a step</h3>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-black/40 hover:bg-black/5"
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
              className="w-full rounded-lg border border-black/20 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black"
            />
            {error && <div className="mt-1.5 text-xs text-red-500">{error}</div>}
            <button
              onClick={submit}
              disabled={!title.trim()}
              className="mt-3 w-full rounded-full border-2 border-black bg-accent py-2 text-sm font-bold text-black disabled:opacity-40"
            >
              Add task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
