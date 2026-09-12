"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Trash2, X } from "lucide-react";
import { CalendarEvent } from "@/types/event";

const COLOR_OPTIONS = ["#6366f1", "#0ea5e9", "#22c55e", "#f97316", "#ec4899", "#a855f7", "#64748b"];

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
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">{mode === "create" ? "New event" : "Edit event"}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
          />

          <div className="flex gap-2">
            <label className="flex-1 text-xs text-neutral-500">
              Start
              <input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              End
              <input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 w-full rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            All day
          </label>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
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
