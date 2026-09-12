// Pure reducer for ExecutionScreen's per-project task list. Every mutation here is a plain
// (events[], args) -> { events[], summary } function with no side effects, so usePlan/useAgent
// can diff before/after state for animations and never has to guess what changed.
//
// Tasks ARE CalendarEvents scoped to one projectId — there's no parallel Task model. This
// keeps the calendar/profile screens (which already read CalendarEvent[]) working unchanged
// while ExecutionScreen adds `status` (pending/done/skipped) and `order` on top.

import { CalendarEvent } from "@/types/event";

export type TaskInput = { title: string; detail?: string; estimateMinutes?: number };

const DEFAULT_ESTIMATE_MINUTES = 20;

export function getPlanTasks(events: CalendarEvent[], projectId: string): CalendarEvent[] {
  return events
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.start.localeCompare(b.start));
}

function reindex(tasks: CalendarEvent[]): CalendarEvent[] {
  return tasks.map((t, i) => ({ ...t, order: i }));
}

function replaceProjectTasks(
  events: CalendarEvent[],
  projectId: string,
  nextTasks: CalendarEvent[]
): CalendarEvent[] {
  const others = events.filter((e) => e.projectId !== projectId);
  return [...others, ...reindex(nextTasks)];
}

function makeTask(
  input: TaskInput,
  projectId: string,
  projectTitle: string,
  color: string | undefined,
  start: Date
): CalendarEvent {
  const minutes = input.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES;
  const end = new Date(start.getTime() + minutes * 60_000);
  return {
    id: crypto.randomUUID(),
    title: input.title,
    notes: input.detail,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    projectId,
    projectTitle,
    color,
    status: "pending",
  };
}

export function addTasks(
  events: CalendarEvent[],
  projectId: string,
  projectTitle: string,
  color: string | undefined,
  inputs: TaskInput[],
  afterTaskId?: string
): { events: CalendarEvent[]; summary: string } {
  const tasks = getPlanTasks(events, projectId);
  const insertAt = afterTaskId ? tasks.findIndex((t) => t.id === afterTaskId) + 1 : tasks.length;
  const anchor = tasks[insertAt - 1] ?? tasks[tasks.length - 1];
  let cursor = anchor ? new Date(anchor.end) : new Date();

  const created = inputs.map((input) => {
    const task = makeTask(input, projectId, projectTitle, color, cursor);
    cursor = new Date(task.end);
    return task;
  });

  const next = [...tasks];
  next.splice(insertAt === -1 ? tasks.length : insertAt, 0, ...created);

  const count = created.length;
  return {
    events: replaceProjectTasks(events, projectId, next),
    summary: `Added ${count} step${count === 1 ? "" : "s"}${created[0] ? `: ${created[0].title}` : ""}`,
  };
}

export function updateTask(
  events: CalendarEvent[],
  id: string,
  patch: { title?: string; detail?: string; estimateMinutes?: number }
): { events: CalendarEvent[]; summary: string } {
  let title = "";
  const next = events.map((e) => {
    if (e.id !== id) return e;
    title = patch.title ?? e.title;
    const end =
      patch.estimateMinutes !== undefined
        ? new Date(new Date(e.start).getTime() + patch.estimateMinutes * 60_000).toISOString()
        : e.end;
    return {
      ...e,
      title: patch.title ?? e.title,
      notes: patch.detail ?? e.notes,
      end,
    };
  });
  return { events: next, summary: `Updated "${title}"` };
}

export function deleteTasks(
  events: CalendarEvent[],
  ids: string[]
): { events: CalendarEvent[]; summary: string } {
  const idSet = new Set(ids);
  const removedTitles = events.filter((e) => idSet.has(e.id)).map((e) => e.title);
  const projectIds = new Set(events.filter((e) => idSet.has(e.id)).map((e) => e.projectId).filter(Boolean));

  let next = events.filter((e) => !idSet.has(e.id));
  for (const projectId of projectIds) {
    next = replaceProjectTasks(next, projectId as string, getPlanTasks(next, projectId as string));
  }

  return {
    events: next,
    summary:
      removedTitles.length === 1
        ? `Removed "${removedTitles[0]}"`
        : `Removed ${removedTitles.length} steps`,
  };
}

export function splitTask(
  events: CalendarEvent[],
  id: string,
  into: TaskInput[]
): { events: CalendarEvent[]; summary: string } {
  const original = events.find((e) => e.id === id);
  if (!original || !original.projectId) return { events, summary: "Couldn't find that step" };

  const tasks = getPlanTasks(events, original.projectId);
  const index = tasks.findIndex((t) => t.id === id);
  const windowStart = new Date(original.start);
  const windowEnd = new Date(original.end);
  const windowMs = Math.max(windowEnd.getTime() - windowStart.getTime(), into.length * 60_000);

  const totalWeight = into.reduce((sum, t) => sum + (t.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES), 0);
  let cursor = windowStart;
  const replacements = into.map((input, i) => {
    const weight = input.estimateMinutes ?? DEFAULT_ESTIMATE_MINUTES;
    const share = totalWeight > 0 ? weight / totalWeight : 1 / into.length;
    const isLast = i === into.length - 1;
    const start = cursor;
    const end = isLast ? windowEnd : new Date(start.getTime() + windowMs * share);
    cursor = end;
    return {
      id: crypto.randomUUID(),
      title: input.title,
      notes: input.detail,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
      projectId: original.projectId,
      projectTitle: original.projectTitle,
      color: original.color,
      status: "pending" as const,
    };
  });

  const next = [...tasks];
  next.splice(index, 1, ...replacements);

  return {
    events: replaceProjectTasks(events, original.projectId, next),
    summary: `Split "${original.title}" into ${into.length} steps`,
  };
}

export function reorderTasks(
  events: CalendarEvent[],
  projectId: string,
  orderedIds: string[]
): { events: CalendarEvent[]; summary: string } {
  const tasks = getPlanTasks(events, projectId);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const next = orderedIds.map((id) => byId.get(id)).filter((t): t is CalendarEvent => !!t);
  // Any task not named in orderedIds (shouldn't happen, but keeps this total) stays at the end.
  for (const t of tasks) if (!orderedIds.includes(t.id)) next.push(t);

  return { events: replaceProjectTasks(events, projectId, next), summary: "Reordered steps" };
}

export function setTaskStatus(
  events: CalendarEvent[],
  id: string,
  status: "pending" | "done" | "skipped"
): CalendarEvent[] {
  return events.map((e) => (e.id === id ? { ...e, status } : e));
}
