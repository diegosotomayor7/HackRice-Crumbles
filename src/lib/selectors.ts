// Pure derivations over the store's `events` list for the home screen. Nothing here
// reads or writes the store directly, so it stays easy to unit-test and to reuse from
// other views later.

import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
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

function projectIdsWithCrumbToday(events: CalendarEvent[], now: Date): Set<string> {
  return new Set(
    events.filter((e) => e.projectId && isSameLocalDay(new Date(e.start), now)).map((e) => e.projectId!)
  );
}

/** Projects with at least one crumb landing today. */
export function projectsToday(events: CalendarEvent[], now: Date = new Date()): ProjectProgress[] {
  const todayIds = projectIdsWithCrumbToday(events, now);
  return projectProgress(events, now).filter((p) => todayIds.has(p.projectId));
}

export type LongtermGoal = {
  projectId: string;
  projectTitle: string;
  nextStepMinutes: number;
};

// Every project not already covered by Today's Plan lands here — including one whose
// crumbs are all overdue/done, so a goal can never quietly vanish from both sections just
// because none of its crumbs happen to land exactly on today. Newest project first (Map
// preserves the order projects first appear in `events`, so this just reverses that).
export function longtermGoals(events: CalendarEvent[], now: Date = new Date()): LongtermGoal[] {
  const todayIds = projectIdsWithCrumbToday(events, now);
  const goals: LongtermGoal[] = [];
  for (const [projectId, list] of groupByProject(events)) {
    if (todayIds.has(projectId)) continue;
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    // Prefer the next crumb still to do; fall back to the last one so a fully-done
    // project still shows something rather than disappearing entirely.
    const next = sorted.find((e) => !isDone(e, now)) ?? sorted[sorted.length - 1];
    goals.push({
      projectId,
      projectTitle: next.projectTitle ?? next.title,
      nextStepMinutes: durationMinutes(next),
    });
  }
  return goals.reverse();
}

/** Earliest not-yet-done event, across all projects and standalone tasks. */
export function nextUpEvent(events: CalendarEvent[], now: Date = new Date()): CalendarEvent | null {
  const pending = events.filter((e) => !isDone(e, now));
  if (pending.length === 0) return null;
  return [...pending].sort((a, b) => a.start.localeCompare(b.start))[0];
}

// Stats for the "My Crumbs" profile page. The week runs Monday-Sunday (matches the
// design mockup, e.g. "Sep. 1 - Sep. 7" for a week starting on a Monday).
const WEEK_STARTS_ON = 1;

export type WeeklyStats = {
  /** Start/end of the current Monday-Sunday week, for display (e.g. "Sep 1 - Sep 7"). */
  weekStart: Date;
  weekEnd: Date;
  /** Crumbs whose end time has already passed, from this week's Monday through now. */
  tasksCompleted: number;
  /** Summed planned duration of those same completed crumbs. */
  minutesSpent: number;
  /**
   * tasksCompleted vs. the same Monday-through-elapsed-time window last week, as a
   * whole-number percent (e.g. 20 for +20%, -50 for -50%). Null when last week had zero
   * completed tasks, since a percent change from zero isn't meaningful.
   */
  tasksCompletedChangePercent: number | null;
  /**
   * Overall percent of all crumbs-with-a-project that are done as of now, minus that same
   * percent as of the equivalent point last week — a percentage-point swing (e.g. 20 for
   * "your projects are 20 points further along than at this point last week").
   */
  longtermProgressChangePercent: number;
};

// Percent of all project crumbs done as of a given moment — isDone is itself just
// `end < asOf`, so evaluating it at two different moments gives a real before/after
// comparison without needing a separate "completed at" timestamp on each crumb.
function overallProgressPercent(events: CalendarEvent[], asOf: Date): number {
  const withProject = events.filter((e) => e.projectId);
  if (withProject.length === 0) return 0;
  const done = withProject.filter((e) => isDone(e, asOf)).length;
  return Math.round((done / withProject.length) * 100);
}

export function weeklyStats(events: CalendarEvent[], now: Date = new Date()): WeeklyStats {
  const weekStart = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const lastWeekStart = subWeeks(weekStart, 1);
  // Same amount of the week has elapsed last week as has elapsed so far this week, so the
  // comparison is apples-to-apples (e.g. "Tue 10am" this week vs. "Tue 10am" last week).
  const lastWeekSamePoint = new Date(lastWeekStart.getTime() + (now.getTime() - weekStart.getTime()));

  const completedInRange = (rangeStart: Date, rangeEnd: Date) =>
    events.filter((e) => {
      const end = new Date(e.end);
      return end >= rangeStart && end <= rangeEnd;
    });

  const thisWeekDone = completedInRange(weekStart, now);
  const lastWeekDone = completedInRange(lastWeekStart, lastWeekSamePoint);

  const tasksCompleted = thisWeekDone.length;
  const minutesSpent = thisWeekDone.reduce((sum, e) => sum + durationMinutes(e), 0);

  const tasksCompletedChangePercent =
    lastWeekDone.length === 0
      ? null
      : Math.round(((tasksCompleted - lastWeekDone.length) / lastWeekDone.length) * 100);

  const longtermProgressChangePercent =
    overallProgressPercent(events, now) - overallProgressPercent(events, lastWeekSamePoint);

  return {
    weekStart,
    weekEnd,
    tasksCompleted,
    minutesSpent,
    tasksCompletedChangePercent,
    longtermProgressChangePercent,
  };
}
