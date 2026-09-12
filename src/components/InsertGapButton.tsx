"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

// Sits between two adjacent cards in the review stack, in the same left-hand column as
// the timeline's date circles (CrumbReview positions it there) so it reads as a stop on
// the same line. Lets the user ask the AI to propose one new task that belongs in the
// gap, using the cards immediately before and after for context (e.g. inferring "build
// the core feature" between "outline the idea" and "record the demo").
export default function InsertGapButton({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: () => Promise<boolean>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (disabled || loading) return;
    setError(null);
    setLoading(true);
    const ok = await onInsert();
    setLoading(false);
    if (!ok) setError(disabled ? "Max cards reached." : "Couldn't add a step there. Try again.");
  };

  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <button
        onClick={run}
        disabled={disabled || loading}
        title={disabled ? "Max cards reached" : "Insert a step here"}
        className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-white text-black transition-transform hover:scale-110 disabled:opacity-30"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
      {error && (
        <div className="absolute top-full left-1/2 mt-1 w-max -translate-x-1/2 text-[11px] text-red-500">
          {error}
        </div>
      )}
    </div>
  );
}
