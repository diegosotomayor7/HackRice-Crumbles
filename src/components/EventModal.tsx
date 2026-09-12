"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Trash2, X } from "lucide-react";
import { CalendarEvent } from "@/types/event";

// Softened tints of the app's own palette (see "UI for crumble/Color Code.txt"), matching
// the colors PROJECT_COLORS in api/chat/route.ts assigns to AI-generated events, plus a
// neutral greige for events with no particular project color.
const COLOR_OPTIONS = ["#e4f7a3", "#f6c98a", "#b79a82", "#fadfb0", "#ede28f", "#d9b896", "#cbbba8"];

export type EventDraft = Omit<CalendarEvent, "id"> & { id?: string };

type EventModalProps = {
  mode: "create" | "edit";
  initial: Partial<CalendarEvent> & { start: string; end: string };
  onSave: (data: EventDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
};

function toLocalInputValue(iso: string) {
  try {
    return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

export default function EventModal({ mode, initial, onSave, onDelete, onClose }: EventModalProps) {
  const [title, setTitle] = useState(initial.title ?? "");
  const [start, setStart] = useState(toLocalInputValue(initial.start));
  const [end, setEnd] = useState(toLocalInputValue(initial.end));
  const [allDay, setAllDay] = useState(initial.allDay ?? false);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [color, setColor] = useState(initial.color ?? COLOR_OPTIONS[0]);
  const [status, setStatus] = useState<CalendarEvent["status"]>(initial.status ?? "pending");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    if (!title.trim()) return;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startISO = startDate.toISOString();
    const endISO = (endDate < startDate ? startDate : endDate).toISOString();

    onSave({
      id: initial.id,
      title: title.trim(),
      start: startISO,
      end: endISO,
      allDay,
      notes: notes.trim() || undefined,
      color,
      projectId: initial.projectId,
      projectTitle: initial.projectTitle,
      status: initial.projectId ? status : initial.status,
      order: initial.order,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card border border-ink/10 p-4 shadow-xl"
        style={{ backgroundColor: color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-ink">{mode === "create" ? "New event" : "Edit event"}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-ink/10 bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-tan"
          />

          <div className="flex gap-2">
            <label className="flex-1 text-xs text-ink-muted">
              Start
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/10 bg-transparent px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="flex-1 text-xs text-ink-muted">
              End
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/10 bg-transparent px-2 py-1.5 text-sm text-ink"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            All day
          </label>

          {/* Only steps that belong to a goal have execution status — a plain calendar
              event has nothing for ExecutionScreen's progress bar to track. Writes the
              same `status` field ExecutionScreen's swipe gesture sets, so either path
              keeps Today's Plan's progress in sync. */}
          {initial.projectId && (
            <div>
              <span className="mb-1 block text-xs text-ink-muted">Status</span>
              <div className="flex gap-1.5">
                {(["pending", "done", "skipped"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={
                      "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium capitalize transition-colors " +
                      (status === s ? "border-ink bg-ink text-bg" : "border-ink/20 text-ink hover:bg-ink/5")
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full resize-none rounded-md border border-ink/10 bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-tan"
          />

          <div className="flex gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className="h-6 w-6 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {mode === "edit" && onDelete ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
