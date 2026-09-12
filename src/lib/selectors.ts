// Pure derivations over the store's `events` list for the home screen. Nothing here
// reads or writes the store directly, so it stays easy to unit-test and to reuse from
// other views later.

import { CalendarEvent } from "@/types/event";

export function stepCount(events: CalendarEvent[], projectId: string): number {
  return events.filter((e) => e.projectId === projectId).length;
}

export function durationMinutes(event: Pick<CalendarEvent, "start" | "end">): number {
  const ms = new Date(event.end).getTime() - new Date(event.start).getTime();
  return Math.max(0, Math.round(ms / 60000 / 5) * 5);
}

// CalendarEvent has no `status` field, so a crumb counts as "done" once its end time
// has passed — the same cutoff CrumbStack already uses to decide what's "upcoming".
export function isDone(event: CalendarEvent, now: Date = new Date()): boolean {
  return new Date(event.end) < now;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupByProject(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byProject = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!e.projectId) continue;
    const list = byProject.get(e.projectId);
    if (list) list.push(e);
    else byProject.set(e.projectId, [e]);
  }
  return byProject;
}

export type ProjectProgress = {
  projectId: string;
  projectTitle: string;
  done: number;
  total: number;
  percent: number;
};

export function projectProgress(events: CalendarEvent[], now: Date = new Date()): ProjectProgress[] {
  return [...groupByProject(events).entries()].map(([projectId, list]) => {
    const done = list.filter((e) => isDone(e, now)).length;
    return {
      projectId,
      projectTitle: list[0].projectTitle ?? list[0].title,
      done,
      total: list.length,
      percent: Math.round((done / list.length) * 100),
    };
  });
}

/** Projects with at least one crumb landing today. */
export function projectsToday(events: CalendarEvent[], now: Date = new Date()): ProjectProgress[] {
  const todayIds = new Set(
    events.filter((e) => e.projectId && isSameLocalDay(new Date(e.start), now)).map((e) => e.projectId!)
  );
  return projectProgress(events, now).filter((p) => todayIds.has(p.projectId));
}

export type LongtermGoal = {
  projectId: string;
  projectTitle: string;
  nextStepMinutes: number;
};

/** Projects whose next pending crumb lands after today. */
export function longtermGoals(events: CalendarEvent[], now: Date = new Date()): LongtermGoal[] {
  const future = events.filter((e) => {
    if (!e.projectId || isDone(e, now)) return false;
    const start = new Date(e.start);
    return !isSameLocalDay(start, now) && start > now;
  });
  return [...groupByProject(future).entries()].map(([projectId, list]) => {
    const next = [...list].sort((a, b) => a.start.localeCompare(b.start))[0];
    return {
      projectId,
      projectTitle: next.projectTitle ?? next.title,
      nextStepMinutes: durationMinutes(next),
    };
  });
}

/** Earliest not-yet-done event, across all projects and standalone tasks. */
export function nextUpEvent(events: CalendarEvent[], now: Date = new Date()): CalendarEvent | null {
  const pending = events.filter((e) => !isDone(e, now));
  if (pending.length === 0) return null;
  return [...pending].sort((a, b) => a.start.localeCompare(b.start))[0];
}
