"use client";

// Fetches 2-4 blocker-chip suggestions for the current step from /api/agent/blockers.
// Re-fetches whenever the step changes; a stale response for a step the user has since
// moved past is discarded via the requestId guard.

import { useEffect, useRef, useState } from "react";

const FALLBACK_CHIPS = ["Not sure how", "Missing something", "Out of time", "Skip for now"];

export function useBlockerChips(taskId: string | undefined, title: string | undefined, detail?: string) {
  const [chips, setChips] = useState<string[]>(FALLBACK_CHIPS);
  const requestId = useRef(0);

  useEffect(() => {
    if (!taskId || !title) return;
    const id = ++requestId.current;

    fetch("/api/agent/blockers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, detail }),
    })
      .then((res) => res.json())
      .then((data: { chips?: string[] }) => {
        if (requestId.current === id && data.chips?.length) setChips(data.chips);
      })
      .catch(() => {
        // fallback chips already set
      });
  }, [taskId, title, detail]);

  return chips;
}
