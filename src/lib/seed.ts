import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { CalendarEvent } from "@/types/event";

// A few pre-populated events so the calendar never looks empty on first load / during a demo.
export function seedEvents(): CalendarEvent[] {
  const today = startOfDay(new Date());
  const at = (dayOffset: number, hour: number, minute = 0) =>
    setMinutes(setHours(addDays(today, dayOffset), hour), minute).toISOString();

  return [
    {
      id: "seed-1",
      title: "Team standup",
      start: at(0, 9, 0),
      end: at(0, 9, 15),
      color: "#6366f1",
    },
    {
      id: "seed-2",
      title: "Design review",
      start: at(0, 13, 0),
      end: at(0, 14, 0),
      color: "#0ea5e9",
    },
    {
      id: "seed-3",
      title: "Gym",
      start: at(1, 7, 30),
      end: at(1, 8, 30),
      color: "#22c55e",
    },
  ];
}
