"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

// Sits between two adjacent cards in the review stack. Lets the user ask the AI to
// propose one new task that belongs in the gap, using the cards immediately before
// and after for context (e.g. inferring "build the core feature" between "outline
// the idea" and "record the demo").
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
    <div className="relative -my-1.5 flex items-center justify-center py-1.5">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/10 dark:bg-white/10" />
      <button
        onClick={run}
        disabled={disabled || loading}
        title={disabled ? "Max cards reached" : "Insert a step here"}
        className="relative flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-neutral-50 text-neutral-400 opacity-60 transition-opacity hover:border-indigo-400 hover:text-indigo-500 hover:opacity-100 disabled:opacity-30 dark:border-white/10 dark:bg-neutral-950"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
      {error && (
        <div className="absolute top-full mt-1 whitespace-nowrap text-[11px] text-red-500">{error}</div>
      )}
    </div>
  );
}
