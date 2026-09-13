"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CalendarEvent, ChatMessage, ChatSession, DraftCrumb } from "@/types/event";
import { seedEvents } from "./seed";
import * as plan from "./plan";
import type { TaskInput } from "./plan";

// Hard cap on how many cards can be staged for review at once — applies to the AI's
// initial breakdown, every further split (+1 net card each time), and every inserted gap-filler.
export const MAX_DRAFT_CRUMBS = 8;

function welcomeMessage(content: string): ChatMessage {
  return { id: crypto.randomUUID(), role: "assistant", content, createdAt: new Date().toISOString() };
}

const DEFAULT_WELCOME =
  "Hi! Tell me about something you need to schedule, or describe a bigger project (e.g. \"build a marketing " +
  "site by Oct 1\") and I'll break it into subtasks on your calendar.";

type CalendarState = {
  events: CalendarEvent[];
  addEvents: (events: CalendarEvent[]) => void;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  resetDemoData: () => void;

  // Each intake conversation lives in its own session, but sessions are never reopened —
  // once a goal exists, "Longterm goals" opens ExecutionScreen, not the chat that made it.
  sessions: Record<string, ChatSession>;
  activeSessionId: string | null;
  /** Start a brand-new chat session and make it active. Returns its id. */
  startNewSession: () => string;
  addMessage: (sessionId: string, message: ChatMessage) => void;

  // Staging stack for the swipe-to-refine review screen. Nothing here is a real
  // calendar event yet — cards only become events when the user commits them
  // (swipe right on one, or "Add all to calendar" for the rest).
  draftCrumbs: DraftCrumb[];
  reviewActive: boolean;
  /** Open the review screen with the AI's initial subtask breakdown for one goal. */
  startReview: (crumbs: DraftCrumb[]) => void;
  /** Replace one draft crumb with its two children. No-op (returns false) at the MAX_DRAFT_CRUMBS cap. */
  splitDraftCrumb: (id: string, children: [DraftCrumb, DraftCrumb]) => boolean;
  /** Add one new crumb to the staging stack (e.g. a gap-filler inserted between two others). No-op at the cap. */
  insertDraftCrumb: (crumb: DraftCrumb) => boolean;
  /** Commit one draft crumb to the calendar and drop it from the staging stack. `isLongtermGoal`
   *  is the review screen's explicit toggle value at the moment of this commit, not inferred. */
  commitDraftCrumb: (id: string, isLongtermGoal?: boolean) => void;
  /** Commit every remaining draft crumb to the calendar and close the review screen. */
  commitAllDraftCrumbs: (isLongtermGoal?: boolean) => void;
  /** Discard the whole staging stack without adding anything to the calendar. */
  discardReview: () => void;

  // ExecutionScreen's agent tools. Each mutates the `events` belonging to one project and
  // returns a short human summary for the ephemeral line above the input bar (see lib/plan.ts
  // for the actual reducer logic — these are thin wrappers so components never touch it raw).
  addTasks: (
    projectId: string,
    projectTitle: string,
    color: string | undefined,
    tasks: TaskInput[],
    afterTaskId?: string
  ) => string;
  updateTask: (id: string, patch: { title?: string; detail?: string; estimateMinutes?: number }) => string;
  deleteTasks: (ids: string[]) => string;
  splitTask: (id: string, into: TaskInput[]) => string;
  reorderTasks: (projectId: string, orderedIds: string[]) => string;
  setTaskStatus: (id: string, status: "pending" | "done") => void;
  /** Generates a plain event's initial steps without touching the event itself — see
   *  plan.generateHiddenSteps. No-op if the event id doesn't exist. */
  generateSteps: (eventId: string, steps: TaskInput[]) => void;
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: seedEvents(),
      addEvents: (newEvents) =>
        set((state) => ({ events: [...state.events, ...newEvents] })),
      updateEvent: (id, patch) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEvent: (id) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

      sessions: {},
      activeSessionId: null,
      startNewSession: () => {
        const id = crypto.randomUUID();
        const session: ChatSession = {
          id,
          title: "New chat",
          messages: [welcomeMessage(DEFAULT_WELCOME)],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          activeSessionId: id,
        }));
        return id;
      },
      addMessage: (sessionId, message) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, messages: [...session.messages, message] },
            },
          };
        }),
      resetDemoData: () =>
        set({
          events: seedEvents(),
          sessions: {},
          activeSessionId: null,
        }),

      draftCrumbs: [],
      reviewActive: false,
      startReview: (crumbs) => set({ draftCrumbs: crumbs, reviewActive: true }),
      splitDraftCrumb: (id, children) => {
        const current = get().draftCrumbs;
        if (current.length >= MAX_DRAFT_CRUMBS) return false;
        const index = current.findIndex((c) => c.id === id);
        if (index === -1) return false;
        const next = [...current];
        next.splice(index, 1, ...children);
        set({ draftCrumbs: next });
        return true;
      },
      insertDraftCrumb: (crumb) => {
        const current = get().draftCrumbs;
        if (current.length >= MAX_DRAFT_CRUMBS) return false;
        set({ draftCrumbs: [...current, crumb] });
        return true;
      },
      commitDraftCrumb: (id, isLongtermGoal) => {
        const current = get().draftCrumbs;
        const crumb = current.find((c) => c.id === id);
        if (!crumb) return;
        const remaining = current.filter((c) => c.id !== id);
        set((state) => ({
          events: [...state.events, { ...crumb, isLongtermGoal }],
          draftCrumbs: remaining,
          reviewActive: remaining.length > 0,
        }));
      },
      commitAllDraftCrumbs: (isLongtermGoal) =>
        set((state) => ({
          events: [...state.events, ...state.draftCrumbs.map((c) => ({ ...c, isLongtermGoal }))],
          draftCrumbs: [],
          reviewActive: false,
        })),
      discardReview: () => set({ draftCrumbs: [], reviewActive: false }),

      addTasks: (projectId, projectTitle, color, tasks, afterTaskId) => {
        const result = plan.addTasks(get().events, projectId, projectTitle, color, tasks, afterTaskId);
        set({ events: result.events });
        return result.summary;
      },
      updateTask: (id, patch) => {
        const result = plan.updateTask(get().events, id, patch);
        set({ events: result.events });
        return result.summary;
      },
      deleteTasks: (ids) => {
        const result = plan.deleteTasks(get().events, ids);
        set({ events: result.events });
        return result.summary;
      },
      splitTask: (id, into) => {
        const result = plan.splitTask(get().events, id, into);
        set({ events: result.events });
        return result.summary;
      },
      reorderTasks: (projectId, orderedIds) => {
        const result = plan.reorderTasks(get().events, projectId, orderedIds);
        set({ events: result.events });
        return result.summary;
      },
      setTaskStatus: (id, status) => set((state) => ({ events: plan.setTaskStatus(state.events, id, status) })),
      generateSteps: (eventId, steps) => {
        const container = get().events.find((e) => e.id === eventId);
        if (!container) return;
        set({ events: plan.generateHiddenSteps(get().events, container, steps) });
      },
    }),
    {
      name: "crumbles-storage", // localStorage key — keeps the demo state across refreshes
    }
  )
);
