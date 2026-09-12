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
    // A ready-to-go "Laundry" plan so ExecutionScreen has something to demo instantly,
    // without going through intake chat first.
    ...laundryPlan(at),
  ];
}

function laundryPlan(at: (dayOffset: number, hour: number, minute?: number) => string): CalendarEvent[] {
  const projectId = "laundry";
  const projectTitle = "Laundry";
  const color = "#fadfb0";
  const steps: { title: string; minutes: number }[] = [
    { title: "Sort darks from lights", minutes: 10 },
    { title: "Load washer and start it", minutes: 10 },
    { title: "Move wet clothes to dryer", minutes: 10 },
    { title: "Fold and put away clothes", minutes: 20 },
  ];
  let hour = 18;
  let minute = 0;
  return steps.map((step, i) => {
    const start = at(0, hour, minute);
    minute += step.minutes;
    if (minute >= 60) {
      hour += Math.floor(minute / 60);
      minute %= 60;
    }
    const end = at(0, hour, minute);
    return {
      id: `seed-laundry-${i}`,
      title: step.title,
      start,
      end,
      allDay: false,
      color,
      projectId,
      projectTitle,
      status: "pending",
      order: i,
    };
  });
}
