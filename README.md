# Flux — the calendar that plans for you

Hackathon starter: a calendar web app with an AI chatbot that (1) quick-creates events
from natural language and (2) breaks a big/vague goal into scheduled subtasks.

## Stack

- **Next.js 15 (App Router) + TypeScript + Tailwind** — web app, deploys to Vercel in one click.
- **FullCalendar** (`@fullcalendar/react`) — month/week/day/list calendar views, drag-to-reschedule, resize.
- **Zustand + localStorage** — all state is client-side and persisted locally. No database needed for the demo.
- **Gemini API** (`@google/genai`) — one function-calling tool (`schedule_calendar_events`) does both quick-create
  and task breakdown; see `src/app/api/chat/route.ts` for the whole AI logic.

Nothing here is provider-locked except that one route file — swapping to OpenAI/Claude later just means
rewriting `route.ts`'s tool-calling code; the calendar/store/UI don't change.

## Getting started

```bash
cp .env.local.example .env.local
# edit .env.local and paste a free key from https://aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000. The calendar comes pre-seeded with a few events so it's never empty.
Without a `GEMINI_API_KEY` set, the chat still runs and tells you how to add one, so frontend work
isn't blocked on the key.

## Try it

- Quick create: `"Lunch with Sarah Thursday at 1pm"` → one event appears.
- Task breakdown (the headline feature): `"Build a marketing website for our launch by Oct 1"` →
  several color-coded subtask events appear across the calendar, grouped by project.
- Drag an event to a new time / resize it on the calendar — it persists (localStorage).

## Suggested 3-person split

1. **Calendar UI** (`src/components/Calendar.tsx`) — polish views, event styling, click-to-edit modal,
   maybe a "delete event" affordance.
2. **AI / chat** (`src/app/api/chat/route.ts`, `src/components/ChatPanel.tsx`) — prompt engineering for
   better breakdowns, handle edits/rescheduling via chat ("move my 3pm to 4pm"), streaming responses.
3. **App shell & demo polish** (`src/app/page.tsx`, `src/lib/store.ts`, deployment) — responsive layout for
   mobile browsers, empty states, seed data for the demo script below, Vercel deploy, PWA install prompt.

Agree on the shapes in `src/types/event.ts` first — everyone can then build against that contract in parallel.

## "Mobile app" without building one from scratch

The site already has `public/manifest.json` + Apple web-app meta tags, so on a phone browser it can be
added to the home screen and opens full-screen like an app — enough for a hackathon demo of "we're
mobile-ready." After the hackathon, the fastest real path to native is **Expo/React Native**, reusing the
same event types and API route (Zustand + fetch work the same there); FullCalendar itself is web-only, so
the calendar view would be rebuilt with a RN calendar lib.

## Demo script (~90 seconds)

1. Open the app — show a normal week with a few existing events (nothing special yet).
2. Type a single quick-create request → an event appears instantly. ("Faster than Google Calendar's UI.")
3. Type a big goal ("Plan and launch a podcast by November") → watch 5-6 subtasks populate the calendar,
   color-coded as one project, already spread across realistic dates.
4. Drag one subtask to a different day to show it's a real, editable calendar, not just a list.
5. Close with the pitch: *"You don't organize your calendar anymore — you just tell it what you want done."*

## Deploy

```bash
npx vercel
```

Set `GEMINI_API_KEY` in the Vercel project's Environment Variables before deploying so the live demo works.
