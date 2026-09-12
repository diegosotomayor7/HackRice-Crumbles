"use client";

import { useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { useCalendarStore } from "@/lib/store";
import { CalendarEvent, ChatMessage, DraftCrumb } from "@/types/event";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type ClarifyQuestion = { slot: string; question: string; options: string[] };

// Per-clarify-message UI state, kept in memory only (like debugByMessage below) — it's a
// transient in-flight interaction, not something that needs to survive a refresh.
type ClarifyState = {
  originalMessage: string;
  questions: ClarifyQuestion[];
  answers: Record<string, string>;
  otherOpen: Record<string, boolean>;
  otherText: Record<string, string>;
  resolved: boolean;
};

type ChatApiResponse =
  | { type: "events"; reply: string; isGoalBreakdown?: boolean; events: CalendarEvent[]; debug?: unknown }
  | { type: "clarify"; reply: string; questions: ClarifyQuestion[]; debug?: unknown };

export default function ChatPanel({ onClose }: { onClose?: () => void }) {
  const activeSessionId = useCalendarStore((s) => s.activeSessionId);
  const session = useCalendarStore((s) => (s.activeSessionId ? s.sessions[s.activeSessionId] : undefined));
  const messages = session?.messages ?? [];
  const addMessage = useCalendarStore((s) => s.addMessage);
  const linkSessionToProject = useCalendarStore((s) => s.linkSessionToProject);
  const addEvents = useCalendarStore((s) => s.addEvents);
  const startReview = useCalendarStore((s) => s.startReview);
  const events = useCalendarStore((s) => s.events);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Debug: raw tool-call payload per assistant message id, kept in memory only
  // (not persisted to the store) so it's easy to inspect without bloating localStorage.
  const [debugByMessage, setDebugByMessage] = useState<Record<string, unknown>>({});
  const [clarifyByMessage, setClarifyByMessage] = useState<Record<string, ClarifyState>>({});

  const callChatApi = async (
    text: string,
    historyMessages: ChatMessage[],
    forceBreakdown: boolean
  ): Promise<ChatApiResponse> => {
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
        history: historyMessages.map((m) => ({ role: m.role, content: m.content, kind: m.kind })),
        clientNow,
        existingEvents: events.map((e) => ({
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          color: e.color,
        })),
        forceBreakdown,
      }),
    });
    return (await res.json()) as ChatApiResponse;
  };

  // Shared tail end of a request: handle whichever response shape came back, add the
  // assistant bubble, and stash any clarify/debug UI state keyed by its message id.
  const handleResponse = (data: ChatApiResponse, originalMessage: string) => {
    console.log("[chat] API response ->", data);
    const assistantId = crypto.randomUUID();

    if (data.debug !== undefined) {
      setDebugByMessage((prev) => ({ ...prev, [assistantId]: data.debug }));
    }

    if (data.type === "clarify") {
      setClarifyByMessage((prev) => ({
        ...prev,
        [assistantId]: {
          originalMessage,
          questions: data.questions ?? [],
          answers: {},
          otherOpen: {},
          otherText: {},
          resolved: false,
        },
      }));
      addMessage(activeSessionId!, {
        id: assistantId,
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
        kind: "clarify",
      });
      return;
    }

    if (data.isGoalBreakdown && data.events?.length) {
      // Big/vague goal: hand the AI's initial subtask breakdown to the swipe-to-refine
      // review screen instead of putting it straight on the calendar — the user can
      // still split any one subtask further (or insert a gap-filler) by swiping.
      const crumbs: DraftCrumb[] = data.events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        notes: e.notes,
        projectId: e.projectId,
        projectTitle: e.projectTitle,
        color: e.color,
        depth: 0,
      }));
      startReview(crumbs);
      // Link this chat to the goal it just produced so its "Longterm goals" card can
      // reopen this exact conversation instead of starting a fresh one next time.
      const projectId = crumbs[0].projectId;
      if (projectId) linkSessionToProject(activeSessionId!, projectId, crumbs[0].projectTitle ?? projectId);
      // The review stack takes over full-screen — close the chat underneath it so
      // dismissing the review lands back on the main crumb stack, not the chat.
      onClose?.();
    } else if (data.events?.length) {
      addEvents(data.events);
    }

    addMessage(activeSessionId!, {
      id: assistantId,
      role: "assistant",
      content: data.reply,
      createdAt: new Date().toISOString(),
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !activeSessionId) return;
    setInput("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    addMessage(activeSessionId, userMessage);
    setLoading(true);

    try {
      const data = await callChatApi(text, [...messages, userMessage], false);
      handleResponse(data, text);
    } catch {
      addMessage(activeSessionId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Network error reaching the AI. Is the dev server running?",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // "Just start": always reachable — never traps the user on the question step. Re-sends
  // the ORIGINAL goal with forceBreakdown so the router is skipped and the model picks
  // sensible defaults instead of asking anything.
  const justStart = async (clarifyMessageId: string) => {
    const state = clarifyByMessage[clarifyMessageId];
    if (!state || loading || !activeSessionId) return;
    setClarifyByMessage((prev) => ({ ...prev, [clarifyMessageId]: { ...prev[clarifyMessageId], resolved: true } }));
    setLoading(true);
    try {
      const data = await callChatApi(state.originalMessage, messages, true);
      handleResponse(data, state.originalMessage);
    } catch {
      addMessage(activeSessionId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Network error reaching the AI. Is the dev server running?",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // Submits the tapped (or typed) answers as a normal, readable chat message — the prior
  // clarify turn is already in `messages` with kind: "clarify", so the router sees it and
  // never asks a second round for this goal.
  const submitAnswers = async (clarifyMessageId: string) => {
    const state = clarifyByMessage[clarifyMessageId];
    if (!state || loading || !activeSessionId) return;

    const slotLabel: Record<string, string> = {
      timeframe: "Timeframe",
      cadence: "Cadence",
      session_length: "Session length",
      starting_point: "Starting point",
    };
    const lines = state.questions
      .map((q) => {
        const answer = state.answers[q.slot]?.trim();
        if (!answer) return null;
        return `${slotLabel[q.slot] ?? q.slot}: ${answer}`;
      })
      .filter((l): l is string => !!l);

    if (lines.length === 0) return;
    const text = lines.join(". ");

    setClarifyByMessage((prev) => ({ ...prev, [clarifyMessageId]: { ...prev[clarifyMessageId], resolved: true } }));

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    addMessage(activeSessionId, userMessage);
    setLoading(true);

    try {
      const data = await callChatApi(text, [...messages, userMessage], false);
      handleResponse(data, text);
    } catch {
      addMessage(activeSessionId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Network error reaching the AI. Is the dev server running?",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const selectOption = (clarifyMessageId: string, slot: string, value: string) => {
    setClarifyByMessage((prev) => {
      const state = prev[clarifyMessageId];
      if (!state) return prev;
      return {
        ...prev,
        [clarifyMessageId]: {
          ...state,
          answers: { ...state.answers, [slot]: value },
          otherOpen: { ...state.otherOpen, [slot]: false },
        },
      };
    });
  };

  const openOther = (clarifyMessageId: string, slot: string) => {
    setClarifyByMessage((prev) => {
      const state = prev[clarifyMessageId];
      if (!state) return prev;
      return { ...prev, [clarifyMessageId]: { ...state, otherOpen: { ...state.otherOpen, [slot]: true } } };
    });
  };

  const setOtherText = (clarifyMessageId: string, slot: string, value: string) => {
    setClarifyByMessage((prev) => {
      const state = prev[clarifyMessageId];
      if (!state) return prev;
      return {
        ...prev,
        [clarifyMessageId]: {
          ...state,
          otherText: { ...state.otherText, [slot]: value },
          answers: { ...state.answers, [slot]: value },
        },
      };
    });
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex items-center gap-2 border-b border-ink/10 p-3">
        <Sparkles className="h-4 w-4 shrink-0 text-tan" />
        <span className="font-heading flex-1 truncate font-medium text-ink">
          {session?.projectId ? session.title : "Crumbles"}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="hide-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => {
          const clarify = clarifyByMessage[m.id];
          return (
            <div key={m.id} className={clsx(m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[85%]")}>
              {m.role === "user" ? (
                <div className="rounded-lg bg-ink px-3 py-2 text-sm whitespace-pre-wrap text-bg">{m.content}</div>
              ) : (
                <Card className="px-3 py-2 text-sm whitespace-pre-wrap text-ink shadow-none">{m.content}</Card>
              )}

              {clarify && (
                <div className="mt-2 space-y-3">
                  {clarify.questions.map((q) => (
                    <div key={q.slot} className="space-y-1.5">
                      <div className="text-xs font-medium text-ink-muted">{q.question}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((opt) => (
                          <button
                            key={opt}
                            disabled={clarify.resolved}
                            onClick={() => selectOption(m.id, q.slot, opt)}
                            className={clsx(
                              "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                              clarify.answers[q.slot] === opt
                                ? "border-ink bg-ink text-bg"
                                : "border-ink/20 bg-bg text-ink hover:bg-ink/5"
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                        <button
                          disabled={clarify.resolved}
                          onClick={() => openOther(m.id, q.slot)}
                          className={clsx(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                            clarify.otherOpen[q.slot]
                              ? "border-ink bg-ink text-bg"
                              : "border-dashed border-ink/30 bg-bg text-ink-muted hover:bg-ink/5"
                          )}
                        >
                          Something else
                        </button>
                      </div>
                      {clarify.otherOpen[q.slot] && !clarify.resolved && (
                        <input
                          autoFocus
                          value={clarify.otherText[q.slot] ?? ""}
                          onChange={(e) => setOtherText(m.id, q.slot, e.target.value)}
                          placeholder="Type your answer"
                          className="w-full rounded-md border border-ink/10 bg-transparent px-2 py-1 text-xs text-ink outline-none focus:border-tan"
                        />
                      )}
                    </div>
                  ))}

                  {!clarify.resolved && (
                    <div className="flex gap-2 pt-0.5">
                      <Button
                        variant="primary"
                        className="!px-3 !py-1.5 text-xs"
                        disabled={loading || Object.keys(clarify.answers).length === 0}
                        onClick={() => submitAnswers(m.id)}
                      >
                        Continue
                      </Button>
                      <Button
                        variant="ghost"
                        className="!px-3 !py-1.5 text-xs"
                        disabled={loading}
                        onClick={() => justStart(m.id)}
                      >
                        Just start
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {debugByMessage[m.id] !== undefined && (
                <details className="mt-1 rounded-md border border-ink/10 bg-bg text-xs text-ink-muted">
                  <summary className="cursor-pointer select-none px-2 py-1 font-medium">
                    tool call (click to expand)
                  </summary>
                  <pre className="overflow-x-auto px-2 pb-2 whitespace-pre-wrap break-all">
                    {JSON.stringify(debugByMessage[m.id], null, 2)}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
        {loading && <Card className="max-w-[85%] px-3 py-2 text-sm text-ink-muted shadow-none">Thinking…</Card>}
      </div>

      <div className="flex gap-2 border-t border-ink/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder='Try: "Build a marketing site by Oct 1"'
          className="flex-1 rounded-md border border-ink/10 bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-tan"
        />
        <Button onClick={send} disabled={loading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
