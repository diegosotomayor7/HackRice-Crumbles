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

// Prefer the explicit status ExecutionScreen sets (swipe right -> "done", the user's own
// call) over elapsed time. Events with no status (plain calendar events never touched by
// ExecutionScreen) fall back to the old time-based heuristic — the cutoff CrumbStack
// already uses to decide what's "upcoming".
export function isDone(event: CalendarEvent, now: Date = new Date()): boolean {
  if (event.status) return event.status === "done";
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

function projectIdsWithCrumbToday(events: CalendarEvent[], now: Date): Set<string> {
  return new Set(
    events.filter((e) => e.projectId && isSameLocalDay(new Date(e.start), now)).map((e) => e.projectId!)
  );
}

/** Individual events landing today, earliest first — Home's "Today's Plan" is now a list of
 *  actual events (each clickable into its own project's execution view), not a per-project
 *  summary. Includes standalone events with no projectId too. Excludes `hidden` events — the
 *  generated steps of a plain event's breakdown, which live only in that event's own
 *  ExecutionScreen, not as separate entries here (see plan.generateHiddenSteps) — and excludes
 *  done ones, so completing a task actually leaves Today's Plan instead of sitting there faded
 *  for the rest of the day (page.tsx animates the exit via AnimatePresence when it's visible). */
export function todaysEvents(events: CalendarEvent[], now: Date = new Date()): CalendarEvent[] {
  return events
    .filter((e) => !e.hidden && !isDone(e, now) && isSameLocalDay(new Date(e.start), now))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// Only projects explicitly marked isLongtermGoal (CrumbReview's toggle at commit time —
// never AI-inferred) land here, and only once nothing from them is due today, so a goal
// can never quietly vanish from both sections just because one of its crumbs happens to
// land exactly on today. A plain recurring series (e.g. "walk the dog every day this
// week") never sets the flag, so it stays out. Newest project first (Map preserves the
// order projects first appear in `events`, so this just reverses that). Home shows these
// as plain progress bars, so the shape is just ProjectProgress.
export function longtermGoals(events: CalendarEvent[], now: Date = new Date()): ProjectProgress[] {
  const todayIds = projectIdsWithCrumbToday(events, now);
  const goals: ProjectProgress[] = [];
  for (const [projectId, list] of groupByProject(events)) {
    if (todayIds.has(projectId) || !list.some((e) => e.isLongtermGoal)) continue;
    const done = list.filter((e) => isDone(e, now)).length;
    goals.push({
      projectId,
      projectTitle: list[0].projectTitle ?? list[0].title,
      done,
      total: list.length,
      percent: Math.round((done / list.length) * 100),
    });
  }
  return goals.reverse();
}

/** Earliest not-yet-done event, across all projects and standalone tasks. Excludes `hidden`
 *  generated steps for the same reason todaysEvents does. */
export function nextUpEvent(events: CalendarEvent[], now: Date = new Date()): CalendarEvent | null {
  const pending = events.filter((e) => !e.hidden && !isDone(e, now));
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

// Percent of all project crumbs done as of a given moment. `isDone` is status-aware (a
// crumb marked done stays done regardless of what moment you ask about), so it's only
// correct for `asOf === now`. For any earlier moment there's no recorded "completed at"
// time to check status against, so fall back to the old pure-schedule proxy: was its
// end time already in the past at that moment. Without this split, a crumb finished
// today would count as "already done last week" too, and silently erase its own
// contribution to the week-over-week change below.
function overallProgressPercent(events: CalendarEvent[], asOf: Date, now: Date): number {
  // isLongtermGoal, not just projectId — a plain event's generated steps have a projectId
  // too (their container's id) but were never declared a goal, so they'd otherwise inflate
  // this specifically-labeled "progress on long term goal" stat.
  const withProject = events.filter((e) => e.projectId && e.isLongtermGoal);
  if (withProject.length === 0) return 0;
  const wasDone = (e: CalendarEvent) => (asOf.getTime() >= now.getTime() ? isDone(e, asOf) : new Date(e.end) < asOf);
  const done = withProject.filter(wasDone).length;
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
      if (e.hidden) return false; // a plain event's generated steps aren't separately "completed"
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
    overallProgressPercent(events, now, now) - overallProgressPercent(events, lastWeekSamePoint, now);

  return {
    weekStart,
    weekEnd,
    tasksCompleted,
    minutesSpent,
    tasksCompletedChangePercent,
    longtermProgressChangePercent,
  };
}
