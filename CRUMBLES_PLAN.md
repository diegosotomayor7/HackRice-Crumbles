---
noteId: "3e9d46f0aebe11f19b725f8793f53a93"
tags: []

---

# CRUMBLES — repo rework plan

You are working on a HackRice 16 project. Read this whole file before writing any code.
Work in phases. **Stop after each phase, summarize what changed, and wait for me to say
"continue" before starting the next one.** Commit at the end of each phase with a clear message.

---

## 1. What this product actually is

The current repo was scaffolded before the product was settled. It currently calls itself
**"Flux — the calendar that plans for you"**, which is an AI calendar. That is the wrong product.

The real product is **Crumbles**:

> Convert intentions to actions. Break a problem into crumbles. What's next?

**Target user:** people with executive dysfunction — chronic procrastination, depression,
cognitive fatigue, short attention span. People for whom the hard part is not *knowing* what
to do, it is *starting*.

**The thesis:** task initiation fails when a task feels vague, aversive, or too big. Crumbles
closes the intention-behavior gap by making the next physical action so small it is impossible
to avoid starting.

**The one differentiating mechanic** (this is the whole product — protect it above everything else):

When the user hits a step they cannot start, they swipe it **left**. The system does not nag,
does not reschedule, does not ask them to explain. It silently breaks *that single step* into
2–4 even smaller crumbs and replaces it in place.

ChatGPT can already break a goal into steps. Nothing can do the above. Every architectural
decision in this rework should protect that mechanic.

**Positioning consequence:** the calendar is a **supporting surface**, not the main event.
The main surface is a vertical stack of crumbs.

---

## 2. Current state of the repo (verified)

- Next.js 16 App Router + TypeScript + Tailwind v4
- `src/types/event.ts` — `CalendarEvent`, `ChatMessage`
- `src/lib/store.ts` — Zustand + `persist` to localStorage, key `flux-calendar-storage`
- `src/lib/seed.ts` — seed events
- `src/app/api/chat/route.ts` — Gemini (`@google/genai`) with one function-calling tool
  `schedule_calendar_events`
- `src/components/Calendar.tsx` — FullCalendar, month/week/day/list, drag + resize
- `src/components/ChatPanel.tsx` — chat UI
- `src/components/EventModal.tsx` — click-to-edit modal
- `src/app/page.tsx` — desktop two-column layout: 360px chat rail + calendar

It works. **Do not rewrite what works.** This is a repositioning and a feature addition, not a
rebuild.

---

## 3. Hard constraints — do not violate

- **Keep FullCalendar.** Do not replace it, do not swap it for a custom calendar. Just demote it.
- **Keep Gemini.** Do not switch LLM providers. Do not add a second provider.
- **Keep Zustand + localStorage.** Do not add a database. Do not add auth, accounts, or login.
- **Keep TypeScript.** Do not convert to JS.
- Do not add new heavy dependencies. `motion` (framer-motion) is the only new dependency
  approved, and only for drag gestures.
- Do not create new files unless a phase explicitly asks for one.
- Do not write tests. Do not add CI. There are ~20 hours left.
- After each phase, verify with `npm run dev` and a quick `npx tsc --noEmit`. Do not get stuck
  in a `npm run build` loop.

---

## 4. Phases

### Phase 0 — Rebrand and re-aim the agent (do this first, it is small and it unblocks the team)

1. Replace every occurrence of "Flux" with "Crumbles" across the repo: `src/app/layout.tsx`
   metadata, `src/app/page.tsx` header, `public/manifest.json`, `README.md`.
   Tagline everywhere: `Convert intentions to actions.`
2. Change the localStorage key in `store.ts` from `flux-calendar-storage` to
   `crumbles-storage` (this also clears stale demo state).
3. **Rewrite the system prompt identity in `src/app/api/chat/route.ts`.** This is the most
   important change in Phase 0. It currently says the assistant is "an AI scheduling assistant
   embedded in a calendar app," which makes the model think in calendar events. Replace that
   framing with something like:

   > You are Crumbles. You help people who struggle to start things. You take a goal and
   > break it into crumbs: single, concrete, physical next actions that take 5–45 minutes and
   > require no further planning or decision-making from the user. A crumb names an observable
   > action ("open the job board and save 3 postings"), never a vague intention ("research
   > internships"). If a crumb still requires the user to decide something before they can
   > start, it is too big.

   Keep all the existing date/time/overlap rules in the prompt — they are working. Only the
   identity and the definition of a good output change.
4. Fix one bug from the team's list only: relative dates are being computed off by a day
   ("tomorrow" landing two days out). This is a prompt fix, not a code fix. Ignore the other
   calendar bugs on the list (all-day events, recurrence counts, overlaps) — out of scope.
5. Rewrite `README.md` to describe Crumbles and the demo path in section 6 below.

### Phase 1 — Restructure: crumb stack becomes the primary surface

The app should read as a mobile-shaped app, with the calendar as a secondary view.

1. Extend `src/types/event.ts`. `CalendarEvent` gains:
   - `status: "pending" | "done"` (default `"pending"`)
   - `parentId?: string` — set when this crumb came from re-decomposing another crumb
   - `depth: number` — 0 for crumbs from the initial breakdown, +1 each re-decomposition
   Keep `projectId` / `projectTitle` as-is; they already group a breakdown.
2. Add store actions: `completeEvent(id)`, `replaceEventWithCrumbs(id, crumbs)` (removes the
   original and inserts the new crumbs in its position, inheriting its `projectId`,
   `projectTitle`, and time window).
3. New component `src/components/CrumbStack.tsx`: a vertical list of the next pending crumbs,
   soonest first, reading from the same store. Cap at ~6 visible. Each crumb card shows the
   title, its time, and which project/goal it belongs to.
4. Rework `src/app/page.tsx`:
   - Centered container, `max-w-[430px]`, phone-shaped, on every breakpoint. This is deliberate
     — we demo on a phone.
   - Top: today's crumb stack. This is the hero.
   - Below / second tab: the existing `<Calendar />`, unchanged.
   - Bottom center: a floating circular `+` button that opens the goal-breakdown chat
     (the existing `ChatPanel`, now as a full-screen view rather than a side rail).
   - Add safe-area padding (`env(safe-area-inset-bottom)`) so it looks right installed as a PWA.
5. `ChatPanel` becomes a full-screen view instead of a 360px rail. Do not rewrite its logic.

### Phase 2 — The swipe mechanic (this is the feature that matters most)

1. Add `motion` and make each crumb card horizontally draggable with `drag="x"`.
   On `onDragEnd`, check the offset:
   - **Right past threshold** → mark complete. Card animates out.
   - **Left past threshold** → "I can't start this" → trigger re-decomposition.
   - Below threshold → snap back.
   Show a color/icon hint behind the card as it is dragged so the affordance is discoverable.
2. Because this must also work with a mouse on a laptop, each card additionally shows two
   small buttons: `✓` (done) and `↓` (too big). Same handlers. Do not build two separate
   interaction systems — the buttons just call the same functions.
3. New route `src/app/api/decompose/route.ts`. Input: the crumb's title, its parent goal
   (`projectTitle`), its current time window, and its `depth`. Output: 2–4 strictly smaller
   crumbs that fit inside the original time window, via the same Gemini function-calling
   pattern already used in `/api/chat`. Prompt requirement: each new crumb must be a
   *physical action the user can begin within 10 seconds of reading it*, and must be smaller
   than the input crumb — never a rephrasing of it.
4. Wire it: swipe left → optimistic UI (the card visually **breaks apart** into smaller cards)
   → call `/api/decompose` → `replaceEventWithCrumbs`. The breaking-apart animation is worth
   spending 30 minutes on; it is what the demo video is built around.
5. The calendar must stay in sync — new crumbs inherit and subdivide the parent's time slot, so
   FullCalendar shows the change too. That cross-surface consistency is a strong demo beat.

### Phase 3 — Voice input

1. Add a mic button to the chat input. Use the browser's `webkitSpeechRecognition` /
   `SpeechRecognition` directly. Roughly 30 lines. No backend, no ElevenLabs, no Whisper.
2. Feature-detect and hide the button where unsupported. Show a live transcript in the input
   field while speaking.
3. Do not build text-to-speech. Do not build the "lock in" / focus page.

### Phase 4 — Visual identity (only if Phases 0–3 are done and working)

The app currently uses the stock Next.js look: Geist font and indigo-500. Judges see that
palette dozens of times a weekend.

1. Define a warm, tactile palette in `globals.css` as CSS variables and use it everywhere.
   The crumb metaphor should be legible in the design: soft, rounded, slightly organic cards
   that look like they can break apart.
2. Pick one distinctive display font for headings from Google Fonts via `next/font`.
3. Empty states and completion states matter more than new features at this point.

Leave detailed visual decisions to me — set up the token structure and a first pass, then stop.

---

## 5. Explicitly out of scope

Do not build these even if they seem easy or seem implied by the code:

- Profile page, settings, usernames, milestones, streaks, focus-hour counters
- The "lock in" / black focus screen with live AI voice
- Multiple-choice "why couldn't you start this?" predictor (possible later stretch; not now)
- Recurring events across many weeks, overlap prevention, all-day event handling
- Google Calendar sync, OAuth, `.ics` export
- Any database, any auth, any user accounts
- React Native / Expo

---

## 6. Acceptance test

When the work is done, this exact sequence must run end to end without a manual refresh, on a
phone-width viewport:

1. Open the app. A stack of crumbs for today is visible. The calendar is one scroll or one tap away.
2. Tap `+`. Speak: *"My goal is to win this year's HackRice. How do I start?"* The transcript
   appears in the input.
3. Send. The agent asks one clarifying question, then produces crumbs which appear both in the
   stack and on the calendar.
4. Swipe the first crumb **right**. It completes and leaves the stack.
5. Swipe the next crumb **left**. It visibly breaks apart into 2–4 smaller crumbs, in place,
   inside the same time slot. The calendar updates to match.
6. Swipe the first of those smaller crumbs right. It completes.

If a change would risk breaking any step of this sequence, do not make the change.
