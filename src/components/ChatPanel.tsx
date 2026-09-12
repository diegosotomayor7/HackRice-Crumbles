"use client";

import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useCalendarStore } from "@/lib/store";
import { CalendarEvent } from "@/types/event";

export default function ChatPanel() {
  const messages = useCalendarStore((s) => s.messages);
  const addMessage = useCalendarStore((s) => s.addMessage);
  const addEvents = useCalendarStore((s) => s.addEvents);
  const events = useCalendarStore((s) => s.events);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Debug: raw tool-call payload per assistant message id, kept in memory only
  // (not persisted to the store) so it's easy to inspect without bloating localStorage.
  const [debugByMessage, setDebugByMessage] = useState<Record<string, unknown>>({});

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user" as const,
      content: text,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);
    setLoading(true);

    try {
      const now = new Date();
      // Format as a naive local timestamp (no UTC conversion) so "now" matches what the
      // calendar displays — Date#toISOString() would shift this to UTC and skew relative
      // dates like "tomorrow" whenever the server/client aren't in the same timezone.
      const pad = (n: number) => String(n).padStart(2, "0");
      const clientNow = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
        now.getHours()
      )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          clientNow,
          existingEvents: events.map((e) => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay })),
        }),
      });
      const data = (await res.json()) as { reply: string; events: CalendarEvent[]; debug?: unknown };

      if (data.events?.length) addEvents(data.events);

      // Also print the full response (including the raw tool call) to the browser console.
      console.log("[chat] API response ->", data);

      const assistantId = crypto.randomUUID();
      if (data.debug !== undefined) {
        setDebugByMessage((prev) => ({ ...prev, [assistantId]: data.debug }));
      }

      addMessage({
        id: assistantId,
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      });
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Network error reaching the AI. Is the dev server running?",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-black/10 p-3 dark:border-white/10">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        <span className="font-medium">Crumble Assistant</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => (
          <div key={m.id} className={clsx(m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[85%]")}>
            <div
              className={clsx(
                "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              )}
            >
              {m.content}
            </div>
            {debugByMessage[m.id] !== undefined && (
              <details className="mt-1 rounded-md border border-black/10 bg-neutral-50 text-xs text-neutral-600 dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-400">
                <summary className="cursor-pointer select-none px-2 py-1 font-medium">
                  tool call (click to expand)
                </summary>
                <pre className="overflow-x-auto px-2 pb-2 whitespace-pre-wrap break-all">
                  {JSON.stringify(debugByMessage[m.id], null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
        {loading && (
          <div className="max-w-[85%] rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-500 dark:bg-neutral-800">
            Thinking…
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-black/10 p-3 dark:border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder='Try: "Build a marketing site by Oct 1"'
          className="flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-white/10"
        />
        <button
          onClick={send}
          disabled={loading}
          className="flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
