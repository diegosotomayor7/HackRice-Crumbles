"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CalendarEvent, ChatMessage } from "@/types/event";
import { seedEvents } from "./seed";

type CalendarState = {
  events: CalendarEvent[];
  messages: ChatMessage[];
  addEvents: (events: CalendarEvent[]) => void;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  resetDemoData: () => void;
};

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      events: seedEvents(),
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hi! Tell me about something you need to schedule, or describe a bigger project (e.g. \"build a marketing site by Oct 1\") and I'll break it into subtasks on your calendar.",
          createdAt: new Date().toISOString(),
        },
      ],
      addEvents: (newEvents) =>
        set((state) => ({ events: [...state.events, ...newEvents] })),
      updateEvent: (id, patch) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      removeEvent: (id) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      resetDemoData: () =>
        set({
          events: seedEvents(),
          messages: [],
        }),
    }),
    {
      name: "crumbles-storage", // localStorage key — keeps the demo state across refreshes
    }
  )
);
