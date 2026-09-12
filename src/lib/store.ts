"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CalendarEvent, ChatMessage, ChatSession, DraftCrumb } from "@/types/event";
import { seedEvents } from "./seed";

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

  // Each chat conversation lives in its own session so a goal's history can be revisited
  // later (e.g. from its "Longterm goals" card) instead of all chats sharing one thread.
  sessions: Record<string, ChatSession>;
  activeSessionId: string | null;
  /** Start a brand-new, unlinked chat session and make it active. Returns its id. */
  startNewSession: () => string;
  /** Open the session already linked to this project, or create one if none exists yet. */
  openProjectSession: (projectId: string, projectTitle: string) => string;
  /** Link a session to the project its conversation just produced (e.g. after a goal breakdown). */
  linkSessionToProject: (sessionId: string, projectId: string, projectTitle: string) => void;
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
  /** Commit one draft crumb to the calendar and drop it from the staging stack. */
  commitDraftCrumb: (id: string) => void;
  /** Commit every remaining draft crumb to the calendar and close the review screen. */
  commitAllDraftCrumbs: () => void;
  /** Discard the whole staging stack without adding anything to the calendar. */
  discardReview: () => void;
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
      openProjectSession: (projectId, projectTitle) => {
        const existing = Object.values(get().sessions).find((s) => s.projectId === projectId);
        if (existing) {
          set({ activeSessionId: existing.id });
          return existing.id;
        }
        const id = crypto.randomUUID();
        const session: ChatSession = {
          id,
          projectId,
          title: projectTitle,
          messages: [welcomeMessage(`Let's keep working on "${projectTitle}".`)],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          activeSessionId: id,
        }));
        return id;
      },
      linkSessionToProject: (sessionId, projectId, projectTitle) =>
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;
          return {
            sessions: { ...state.sessions, [sessionId]: { ...session, projectId, title: projectTitle } },
          };
        }),
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
      commitDraftCrumb: (id) => {
        const current = get().draftCrumbs;
        const crumb = current.find((c) => c.id === id);
        if (!crumb) return;
        const remaining = current.filter((c) => c.id !== id);
        set((state) => ({
          events: [...state.events, crumb],
          draftCrumbs: remaining,
          reviewActive: remaining.length > 0,
        }));
      },
      commitAllDraftCrumbs: () =>
        set((state) => ({
          events: [...state.events, ...state.draftCrumbs],
          draftCrumbs: [],
          reviewActive: false,
        })),
      discardReview: () => set({ draftCrumbs: [], reviewActive: false }),
    }),
    {
      name: "crumbles-storage", // localStorage key — keeps the demo state across refreshes
    }
  )
);
