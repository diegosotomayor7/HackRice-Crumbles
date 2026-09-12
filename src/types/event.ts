// Core data model shared by the calendar UI, the Zustand store, and the AI chat API route.
// Keep this the single source of truth so the calendar and chatbot never disagree on shape.

export type CalendarEvent = {
  id: string;
  title: string;
  /** ISO 8601 datetime, e.g. 2026-09-12T14:00:00 */
  start: string;
  /** ISO 8601 datetime */
  end: string;
  allDay?: boolean;
  /** Hex color, used to color-code events that belong to the same AI-generated project/breakdown */
  color?: string;
  /** Groups subtasks created together from one "break this down" request */
  projectId?: string;
  projectTitle?: string;
  notes?: string;
  /** Execution state within its project. Undefined is treated as "pending" — only
   * ExecutionScreen reads/writes this, so events outside a project never need it. */
  status?: "pending" | "done";
  /** Position within its project's step list. Undefined falls back to start-time order. */
  order?: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  /** Set on an assistant turn that asked tap-to-answer clarifying questions, so the chat route's
   * router can see (via `history`) that this goal already had its one clarify round and must not
   * ask again. */
  kind?: "clarify";
};

// One intake chat conversation. Only used while a goal is being broken down into its
// initial crumbs (see CrumbReview) — once committed, "Longterm goals" opens ExecutionScreen
// directly, not this conversation, so a session is never reopened after its goal exists.
export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
};

// A crumb the user hasn't committed to the calendar yet. Lives in a separate staging
// list (`draftCrumbs` in the store) so the user can keep swiping — right to commit it as
// a real CalendarEvent, left to split it into two smaller crumbs — before anything touches
// the calendar. Same shape as CalendarEvent plus `depth`, which tracks how many times this
// branch has been split (0 = the original goal card) so the AI can be pushed toward more
// concrete actions the deeper it goes.
export type DraftCrumb = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  notes?: string;
  projectId?: string;
  projectTitle?: string;
  color?: string;
  depth: number;
};
