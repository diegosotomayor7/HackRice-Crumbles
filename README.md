# Crumbles

Convert intentions to actions.

Crumbles is a phone-shaped Next.js app that turns whatever you type or say — "clean the
bathroom later today," "I want to run a 5K by December," "reschedule my dentist thing to
next week" — into scheduled calendar events, breaking bigger goals into bite-sized
"crumbs" along the way. A Gemini-backed AI does the classifying, scheduling, and
breaking-down; you stay in control of what actually lands on your calendar.

## Core ideas

- **Tasks ARE calendar events.** There's no separate "task" data model — every crumb,
  step, or goal-piece is a `CalendarEvent` (see [src/types/event.ts](src/types/event.ts)),
  optionally scoped to a `projectId`. This keeps the calendar, Home, and profile screens
  all reading the same list.
- **The AI classifies before it schedules.** Every message to `/api/chat` first runs
  through a cheap classification pass that decides whether you're describing one concrete,
  same-day thing (schedule it directly) or a genuine multi-day/week/month goal that needs
  breaking into pieces (`isGoalBreakdown`). A same-day chore with sub-steps ("clean my
  bathroom" — sink, toilet, floor) stays a single scheduled event, not a goal breakdown.
- **Long-term goals are opt-in, not inferred.** The AI never decides something is a
  "long-term goal" on your behalf. Whether a breakdown gets tracked as one is a toggle you
  flip yourself in the review screen before committing it to the calendar
  (`isLongtermGoal` on `CalendarEvent`). A recurring plain series like "walk the dog every
  day this week" is not a long-term goal unless you say so.
- **Steps can be generated without cluttering the calendar.** Tapping a plain event in
  Today's Plan generates 2–4 sub-steps for it on demand, but those steps are tagged
  `hidden: true` — they live only inside that event's own execution view, never as
  separate blocks on the calendar or extra rows on Home. The original event ("container")
  is untouched and auto-flips to done once all its hidden steps are.
- **Naive local time throughout.** Dates/times are treated as local wall-clock time
  everywhere (via `date-fns`, using `getFullYear()`/`getMonth()`/`getDate()` rather than
  `toISOString()` for any date-only math) specifically to avoid UTC-shift bugs when the
  server and browser disagree about timezone offsets.

## Using the app

### Home

- **Header** — avatar, greeting, notifications bell.
- **Add new task** — opens the chat overlay to describe something new.
- **Next up for you** — the single soonest not-yet-done event across your whole calendar
  (not per-project). "Crumb it!" opens its execution view, generating steps for it first
  if it doesn't have any yet.
- **Today's Plan** — every event landing today (excluding hidden generated steps and
  anything already done), each tappable into its own execution view. Completing a task
  animates it out of this list on your way back from the execution screen.
- **Longterm goals** — one white card per goal explicitly marked long-term at commit time,
  each showing a progress bar. Tapping one opens its read-only timeline. A goal only
  appears here once nothing from it is due today (it shows under Today's Plan on days it
  has something due).

### Calendar

A `FullCalendar`-powered day/week/month/list view (`src/components/Calendar.tsx`) for
directly viewing, creating, dragging, resizing, and deleting events. Hidden generated
steps are filtered out here too — only "real" scheduled events ever appear as calendar
blocks.

### My Crumbs (profile tab)

Weekly stats (tasks completed, minutes spent, week-over-week deltas) plus a "Details" link
into the crumb stack (`CrumbStack`) — a scrollable list of upcoming/past crumbs. This is
the only way to reach the crumb stack; it's not a bottom-nav tab of its own.

### Overlays

These are full-screen takeovers layered on top of Home (which stays mounted underneath,
not unmounted, so its state — like an in-progress exit animation — survives the trip):

- **ChatPanel** — the AI conversation. Handles both a direct scheduling response and a
  clarifying question (tap-to-answer chips, a free-text "something else" fallback, and a
  "Just start" button that forces a breakdown if you'd rather skip the back-and-forth).
- **CrumbReview** — shown after the AI returns a goal breakdown. A vertical timeline of
  draft crumbs; swipe a card left to split it further (calls `/api/decompose`), swipe
  right (or tap) to commit it to the calendar, or insert a gap step between two cards. The
  "Track as a long-term goal" toggle here is the only place `isLongtermGoal` gets set.
  "Add all to calendar" commits everything still on the board at once.
- **ExecutionScreen** — one project's step-by-step execution view: a stack of step cards
  (swipe right to mark done, swipe left to ask the AI to break the current step down
  further), upcoming-step peeks, a progress bar, contextual "blocker" suggestion chips
  (`/api/agent/blockers`), and a free-text input scoped to the current step for anything
  else (add/edit/delete/reorder/split steps, via `/api/agent`).
- **GoalTimeline** — a read-only version of CrumbReview's timeline layout for an existing
  long-term goal, opened by tapping its progress bar on Home. The only interaction is a
  per-step check button that marks it done/pending, which feeds straight back into that
  goal's (and Home's) progress bar.

## AI backend

All AI calls go through Google's Gemini API (`@google/genai`, model
`gemini-3.5-flash-lite`) using function-calling exclusively — the model is always
constrained to call a specific tool/schema rather than free-form chat.

| Route | Purpose |
|---|---|
| [src/app/api/chat/route.ts](src/app/api/chat/route.ts) | Main entry point from ChatPanel. Classifies the message (`isGoalBreakdown`) using a cheap schema-constrained call, then either schedules a concrete event directly or returns a goal breakdown for CrumbReview — or asks a clarifying question first if the request is ambiguous. Computes precise "today/tomorrow/this week/next week" date ranges itself (via `date-fns`) and hands the model exact ISO ranges to use, rather than trusting it to compute relative dates. Also passes existing events' colors/times so new events get varied colors and time-of-day instead of clashing with what's already scheduled. |
| [src/app/api/decompose/route.ts](src/app/api/decompose/route.ts) | Splits one draft crumb into exactly two, for CrumbReview's swipe-left-to-split gesture. |
| [src/app/api/generate-steps/route.ts](src/app/api/generate-steps/route.ts) | Guarantees 2–4 steps for one plain calendar event (used when you tap into Today's Plan), unlike the judgment-based agent tool below which can decline to split something it doesn't consider "too big." |
| [src/app/api/agent/route.ts](src/app/api/agent/route.ts) | ExecutionScreen's general-purpose step agent: `add_tasks`, `update_task`, `delete_tasks`, `split_task`, `reorder_tasks`, `reply_only`. |
| [src/app/api/agent/blockers/route.ts](src/app/api/agent/blockers/route.ts) | Suggests a few short "what's blocking you" chips for the current step (`suggest_blockers`), with a 2s timeout and a static fallback set if the model doesn't respond in time. |

## State model

Everything lives in one Zustand store with the `persist` middleware
([src/lib/store.ts](src/lib/store.ts)), saved to `localStorage` under the key
`crumbles-storage`. All the actual list-mutation logic is pure reducer functions in
[src/lib/plan.ts](src/lib/plan.ts) (`addTasks`, `updateTask`, `deleteTasks`, `splitTask`,
`reorderTasks`, `setTaskStatus`, `generateHiddenSteps`) so it's easy to reason about and
test independent of the store/UI. Derived, read-only views for Home and the profile page
(what's due today, the next-up event, long-term-goal progress, weekly stats) live in
[src/lib/selectors.ts](src/lib/selectors.ts).

Key `CalendarEvent` fields beyond the obvious title/start/end:

- `projectId` / `projectTitle` — groups an event with its siblings (a goal's steps, or a
  plain event's generated hidden steps).
- `status?: "pending" | "done"` — set by ExecutionScreen/GoalTimeline's check actions.
- `isLongtermGoal?: boolean` — explicit, user-set only, gates Home's "Longterm goals"
  section.
- `hidden?: boolean` — generated micro-steps of a plain event's breakdown; excluded from
  the calendar, Today's Plan, and stats, but reachable through their container event's
  execution view.
- A "container" event (a plain event that's had steps generated for it) is recognizable
  because its own `id` equals its `projectId` — distinguishing it from a real long-term
  goal, whose `projectId` is a distinct title string, not any one event's own id.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4**, with a small `cn()` wrapper around `tailwind-merge`
  ([src/lib/cn.ts](src/lib/cn.ts)) that also registers the app's custom `rounded-card` /
  `shadow-card` utilities so conflicting classes reliably dedupe
- **Zustand 5** (+ `persist`) for state
- **`@google/genai`** for Gemini access
- **`motion`** (the Framer Motion successor) for swipe gestures and enter/exit animations
- **`date-fns`** for date arithmetic
- **FullCalendar** (`@fullcalendar/react` + day-grid/time-grid/list/interaction plugins)
  for the Calendar tab
- **`lucide-react`** for icons, **`clsx`** + `tailwind-merge` for class composition,
  **`uuid`**-style `crypto.randomUUID()` for ids

Custom fonts: **Baloo 2** (`font-heading`, used generally) and **Jersey 25**
(`font-jersey`, reserved for the "Next up for you" heading only). Palette lives in
`UI for crumble/Color Code.txt` — Oat `#f8f4ea`, Sprout/Acid Green `#d7f960`, Cookie
`#f4b35e`, Choco `#6b3f24`, Crumb `#fad9a2`. Every full-screen surface is constrained to
`max-w-[430px] mx-auto` to keep the phone-frame layout consistent regardless of viewport.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env example and add your own Gemini API key (get one at
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey)):
   ```bash
   cp .env.local.example .env.local
   ```
   ```
   GEMINI_API_KEY=your-key-here
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000). For the intended phone-frame
   experience, use your browser's device-toolbar / responsive mode at ~400px width.

On first load, the store seeds itself with a few demo events (a standup, a design review,
a gym session, and a 4-step "Laundry" project) — see [src/lib/seed.ts](src/lib/seed.ts).
Clearing `localStorage`'s `crumbles-storage` key resets to that seed state.
