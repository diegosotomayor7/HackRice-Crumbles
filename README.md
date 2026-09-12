# Crumbles

> Convert intentions to actions. Break a problem into crumbles. What's next?

Crumbles is built for people with executive dysfunction — chronic procrastination, depression,
cognitive fatigue, short attention span — for whom the hard part is never *knowing* what to do,
it's *starting*. Task initiation fails when a task feels vague, aversive, or too big. Crumbles
closes that gap by making the next physical action so small it's impossible to avoid starting.

The core mechanic: when a step feels impossible to start, swipe it left. The app doesn't nag,
reschedule, or ask you to explain — it silently breaks that single step into 2-4 smaller crumbs
and replaces it in place.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind** — web app, deploys to Vercel in one click.
- **FullCalendar** (`@fullcalendar/react`) — a supporting surface: month/week/day/list views,
  drag-to-reschedule, resize. The main surface is the crumb stack, not the calendar.
- **Zustand + localStorage** — all state is client-side and persisted locally. No database needed
  for the demo.
- **Gemini API** (`@google/genai`) — function-calling tool (`schedule_calendar_events`) turns a
  goal into crumbs; see `src/app/api/chat/route.ts` for the whole AI logic.

## Getting started

```bash
cp .env.local.example .env.local
# edit .env.local and paste a free key from https://aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000. The app comes pre-seeded with a few crumbs so it's never empty.
Without a `GEMINI_API_KEY` set, the chat still runs and tells you how to add one, so frontend work
isn't blocked on the key.

## Demo path

1. Open the app. A stack of crumbs for today is visible. The calendar is one scroll or one tap away.
2. Tap `+` and describe a goal (e.g. "My goal is to win this year's HackRice. How do I start?").
3. Crumbs appear in the stack and on the calendar.
4. Swipe a crumb right to complete it.
5. Swipe a crumb left when you can't start it — it breaks apart into 2-4 smaller crumbs, in place,
   inside the same time slot. The calendar updates to match.

## Deploy

```bash
npx vercel
```

Set `GEMINI_API_KEY` in the Vercel project's Environment Variables before deploying so the live
demo works.
