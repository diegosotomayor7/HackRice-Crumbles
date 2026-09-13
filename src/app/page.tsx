"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Bell, ChevronsRight, Loader2, PlayCircle } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CrumbStack from "@/components/CrumbStack";
import CrumbReview from "@/components/CrumbReview";
import ExecutionScreen from "@/components/ExecutionScreen";
import GoalTimeline from "@/components/GoalTimeline";
import ProfilePage from "@/components/ProfilePage";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import ProgressRow from "@/components/ui/ProgressRow";
import { useCalendarStore } from "@/lib/store";
import { durationMinutes, longtermGoals, nextUpEvent, todaysEvents } from "@/lib/selectors";
import { CalendarEvent } from "@/types/event";

// FullCalendar touches window/document — load client-side only.
const Calendar = dynamic(() => import("@/components/Calendar"), { ssr: false });

// A different cookie per longterm goal card (cycling if there are more goals than icons),
// pulled from "UI for crumble/Assets" so each goal reads as visually distinct.
const GOAL_ICONS = [
  "/mascot/goal-icon-1.png",
  "/mascot/goal-icon-2.png",
  "/mascot/goal-icon-3.png",
  "/mascot/goal-icon-4.png",
  "/mascot/goal-icon-5.png",
  "/mascot/goal-icon-6.png",
  "/mascot/goal-icon-7.png",
  "/mascot/goal-icon-8.png",
];

type Tab = "home" | "calendar" | "crumbs" | "profile";

// Design placeholder until accounts exist.
const USER_NAME = "User";

const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("home");
  const [chatOpen, setChatOpen] = useState(false);
  const [executionProjectId, setExecutionProjectId] = useState<string | null>(null);
  const [timelineProjectId, setTimelineProjectId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  // Snapshot of Today's Plan's ids taken the moment the user leaves Home for ExecutionScreen
  // or GoalTimeline, held stable — even once a task's status changes underneath it — until
  // they come back, so the "this vanished" animation plays on return instead of already
  // having happened off-screen (both are full-screen overlays; Home stays mounted, just
  // hidden, the whole time). Null means "not overlaid right now, just show the live list".
  const [frozenTodayIds, setFrozenTodayIds] = useState<string[] | null>(null);

  const events = useCalendarStore((s) => s.events);
  const reviewActive = useCalendarStore((s) => s.reviewActive);
  const startNewSession = useCalendarStore((s) => s.startNewSession);
  const generateSteps = useCalendarStore((s) => s.generateSteps);

  const next = useMemo(() => nextUpEvent(events), [events]);
  const today = useMemo(() => todaysEvents(events), [events]);
  const longterm = useMemo(() => longtermGoals(events), [events]);

  const displayedToday = useMemo(() => {
    if (!frozenTodayIds) return today;
    const byId = new Map(events.map((e) => [e.id, e]));
    return frozenTodayIds.map((id) => byId.get(id)).filter((e): e is CalendarEvent => Boolean(e));
  }, [frozenTodayIds, today, events]);

  const freezeToday = () => setFrozenTodayIds((prev) => prev ?? today.map((e) => e.id));
  const closeExecutionScreen = () => {
    setExecutionProjectId(null);
    setFrozenTodayIds(null);
  };
  const closeGoalTimeline = () => {
    setTimelineProjectId(null);
    setFrozenTodayIds(null);
  };

  // Every Today's Plan event opens ExecutionScreen — that's the whole point of this being
  // "only accessible through Today's Plan" rather than the plain edit popup Calendar still
  // uses. A project-linked event (a real long-term goal's step) already has steps, so it
  // opens directly. A standalone event (no project — a one-off task like "Clean bathroom")
  // is never itself turned into a project or renamed — breaking it down must not spawn new
  // calendar entries. Instead: if nothing already references it as a container (checked by
  // projectId, since generateSteps only ever links children to it, never mutates it), a
  // guaranteed 2-4 physical steps are generated (/api/generate-steps — not /api/agent's
  // split_task, which may reasonably decline a task it judges isn't "too big") and attached
  // as hidden steps behind it; either way ExecutionScreen then opens keyed on the event's own
  // id. If generation fails, it still opens with zero steps rather than dead-ending the tap.
  const openTodayEvent = async (e: CalendarEvent) => {
    freezeToday();
    if (e.projectId) {
      setExecutionProjectId(e.projectId);
      return;
    }
    const alreadyHasSteps = events.some((ev) => ev.projectId === e.id);
    if (!alreadyHasSteps) {
      setGeneratingId(e.id);
      try {
        const res = await fetch("/api/generate-steps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: e.title, notes: e.notes, totalMinutes: durationMinutes(e) }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            steps: { title: string; detail?: string; estimateMinutes?: number }[];
          };
          if (data.steps?.length) generateSteps(e.id, data.steps);
        }
      } catch {
        // Fall through — ExecutionScreen still opens, just with nothing generated yet.
      } finally {
        setGeneratingId(null);
      }
    }
    setExecutionProjectId(e.id);
  };

  return (
    <div className="mx-auto flex h-screen w-full max-w-[430px] flex-col bg-bg">
      {tab === "home" && (
        <main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
          <header className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-surface">
              <img src="/mascot/avatar.png" alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading truncate text-lg font-semibold text-black">
                {greeting(new Date())}, {USER_NAME}
              </h1>
              <p className="text-sm text-black/60">Welcome back!</p>
            </div>
            <button
              aria-label="Notifications"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-black hover:bg-black/10"
            >
              <Bell className="h-6 w-6" />
            </button>
          </header>

          <div className="flex flex-col gap-5 px-4 pb-4">
            <Card
              onClick={() => {
                startNewSession();
                setChatOpen(true);
              }}
              className="relative flex cursor-pointer items-center justify-between gap-3 border-2 border-black p-4"
            >
              <span className="text-lg text-black">Add new task</span>
              <img src="/mascot/add-task.png" alt="" className="h-10 w-10 shrink-0" />
            </Card>

            <div>
              {next ? (
                <Card className="relative flex flex-col gap-3 overflow-visible border-black bg-accent p-5 pr-24">
                  <img
                    src="/mascot/next-up.png"
                    alt=""
                    className="pointer-events-none absolute -right-2 -up-10 h-32 w-32 object-contain"
                  />
                  <h2 className="font-jersey text-3xl text-black">Next up for you</h2>
                  <div>
                    <p className="text-sm font-medium text-black">{timeFormatter.format(new Date(next.start))}</p>
                    <p className="text-sm text-black">{next.title}</p>
                  </div>
                  <div className="flex items-end justify-between">
                    {/* Same handler Today's Plan cards use — generates and opens this one
                        task's steps in ExecutionScreen (or reopens them if already generated),
                        never a whole project's other steps. */}
                    <Button variant="outline" onClick={() => openTodayEvent(next)}>
                      Crumb it!
                    </Button>
                    <p className="mr-4 text-xs text-black/60">Time ~{durationMinutes(next)}min</p>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 text-center text-sm text-black/60">
                  Nothing coming up. Tell the chat about a goal to get started.
                </Card>
              )}
            </div>

            <div>
              <SectionHeader
                title="Today's Plan"
                action={
                  <button onClick={() => setTab("calendar")} className="flex items-center gap-0.5 text-black/60">
                    Full calendar
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                }
              />
              <div className="mt-2 grid grid-cols-2 gap-3">
                <AnimatePresence>
                  {displayedToday.length > 0 ? (
                    displayedToday.map((e, i) => {
                      const generating = generatingId === e.id;
                      return (
                        <motion.button
                          key={e.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          // A task leaves `today` (see selectors.todaysEvents) the instant it's
                          // marked done, so this is the one moment it's still on screen to react
                          // to that — crumble away instead of just vanishing.
                          exit={{ opacity: 0, scale: 0.3, rotate: -18, y: 24, transition: { duration: 0.35 } }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openTodayEvent(e)}
                          disabled={generating}
                          className={clsx("text-left", generating && "opacity-50")}
                        >
                          <Card className="flex flex-col gap-2 border-black bg-gradient-to-b from-bg to-accent p-3 hover:shadow-md">
                            <div className="flex items-center justify-between">
                              {generating ? (
                                <Loader2 className="h-9 w-9 animate-spin text-accent-deep" strokeWidth={1.5} />
                              ) : (
                                <PlayCircle className="h-9 w-9 text-accent-deep" strokeWidth={1.5} />
                              )}
                              <img
                                src={GOAL_ICONS[i % GOAL_ICONS.length]}
                                alt=""
                                className="h-11 w-11 object-contain"
                              />
                            </div>
                            <div>
                              <p className="truncate text-sm font-bold text-black">{e.title}</p>
                              <p className="text-xs font-light text-black/60">
                                {e.allDay ? "All day" : timeFormatter.format(new Date(e.start))}
                              </p>
                            </div>
                          </Card>
                        </motion.button>
                      );
                    })
                  ) : (
                    <Card className="col-span-2 p-3 text-center text-sm text-black/60">
                      Nothing scheduled for today.
                    </Card>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div>
              <SectionHeader
                title="Longterm goals"
                action={
                  <button onClick={() => setTab("crumbs")} className="flex items-center gap-0.5 text-black/60">
                    Details
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                }
              />
              <div className="mt-2 flex flex-col gap-3">
                {longterm.length > 0 ? (
                  longterm.map((p) => (
                    <button
                      key={p.projectId}
                      onClick={() => {
                        freezeToday();
                        setTimelineProjectId(p.projectId);
                      }}
                      className="text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Card className="border-2 border-black p-4 hover:shadow-md">
                        <ProgressRow
                          title={p.projectTitle}
                          label={`${p.done}/${p.total} · ${p.percent}% done`}
                          progress={p.percent}
                        />
                      </Card>
                    </button>
                  ))
                ) : (
                  <Card className="border-2 border-black p-4 text-sm text-black/60">No longterm goals yet.</Card>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {tab === "calendar" && (
        <main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <Calendar />
        </main>
      )}

      {tab === "crumbs" && (
        <main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <CrumbStack />
        </main>
      )}

      {tab === "profile" && (
        <main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
          <ProfilePage />
        </main>
      )}

      <nav
        className="flex justify-around rounded-t-[21px] bg-bg pt-2 pb-4 shadow-[0_-1px_20px_rgba(0,0,0,0.1)]"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {(
          [
            { key: "home", label: "Home", icon: "/mascot/nav-home.png" },
            { key: "calendar", label: "Calendar", icon: "/mascot/nav-calendar.png" },
            { key: "profile", label: "My crumbs", icon: "/mascot/nav-crumbs.png" },
          ] as const
        ).map(({ key, label, icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} className="flex flex-1 flex-col items-center gap-1">
              <img
                src={icon}
                alt=""
                className={clsx("h-12 w-12 object-contain transition-all", active ? "scale-110" : "opacity-50")}
              />
              <span className={clsx("text-xs", active ? "font-bold text-black" : "font-normal text-black/40")}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {chatOpen && (
        <div className="fixed inset-0 z-50 mx-auto w-full max-w-[430px] bg-bg">
          <ChatPanel onClose={() => setChatOpen(false)} />
        </div>
      )}

      {/* Full-screen takeover: swiping through a goal's crumbs replaces the whole app
          until the user commits them (or discards) — see CrumbReview for why. */}
      {reviewActive && <CrumbReview />}

      {executionProjectId && <ExecutionScreen projectId={executionProjectId} onExit={closeExecutionScreen} />}

      {timelineProjectId && <GoalTimeline projectId={timelineProjectId} onClose={closeGoalTimeline} />}
    </div>
  );
}
