"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Bell, ChevronsRight, PlayCircle } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CrumbStack from "@/components/CrumbStack";
import CrumbReview from "@/components/CrumbReview";
import ProfilePage from "@/components/ProfilePage";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import ProgressRow from "@/components/ui/ProgressRow";
import { useCalendarStore } from "@/lib/store";
import { durationMinutes, longtermGoals, nextUpEvent, projectsToday, stepCount } from "@/lib/selectors";

// FullCalendar touches window/document — load client-side only.
const Calendar = dynamic(() => import("@/components/Calendar"), { ssr: false });

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

  const events = useCalendarStore((s) => s.events);
  const reviewActive = useCalendarStore((s) => s.reviewActive);
  const startNewSession = useCalendarStore((s) => s.startNewSession);
  const openProjectSession = useCalendarStore((s) => s.openProjectSession);

  const next = useMemo(() => nextUpEvent(events), [events]);
  const today = useMemo(() => projectsToday(events), [events]);
  const longterm = useMemo(() => longtermGoals(events), [events]);

  return (
    <div className="mx-auto flex h-screen w-full max-w-[430px] flex-col bg-bg">
      {tab === "home" && (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <header className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-surface">
              <img src="/mascot/avatar.png" alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading truncate text-lg font-semibold text-ink">
                {greeting(new Date())}, {USER_NAME}
              </h1>
              <p className="text-sm text-ink-muted">Welcome back!</p>
            </div>
            <button
              aria-label="Notifications"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-ink/10"
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
              className="relative flex cursor-pointer items-center justify-between gap-3 border-2 border-ink p-4"
            >
              <span className="text-lg text-ink">Add new task</span>
              <img src="/mascot/add-task.png" alt="" className="h-10 w-10 shrink-0" />
            </Card>

            <div>
              {next ? (
                <Card className="relative flex flex-col gap-3 overflow-visible bg-accent p-5 pr-24">
                  <img
                    src="/mascot/next-up.png"
                    alt=""
                    className="pointer-events-none absolute -right-2 -bottom-4 h-28 w-28 object-contain"
                  />
                  <h2 className="font-heading text-xl font-bold text-ink">Next up for you</h2>
                  <div>
                    <p className="text-sm font-medium text-ink">{timeFormatter.format(new Date(next.start))}</p>
                    <p className="text-sm text-ink">
                      {next.title}
                      {next.projectId ? ` · ${stepCount(events, next.projectId)} step action` : ""}
                    </p>
                  </div>
                  <div className="flex items-end justify-between">
                    <Button variant="outline" onClick={() => setTab("crumbs")}>
                      Crumb it!
                    </Button>
                    <p className="mr-4 text-xs text-ink-muted">Time ~{durationMinutes(next)}min</p>
                  </div>
                </Card>
              ) : (
                <Card className="p-4 text-center text-sm text-ink-muted">
                  Nothing coming up. Tell the chat about a goal to get started.
                </Card>
              )}
            </div>

            <div>
              <SectionHeader
                title="Today's Plan"
                action={
                  <button onClick={() => setTab("calendar")} className="flex items-center gap-0.5 text-ink-muted">
                    Full calendar
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                }
              />
              <Card className="mt-2 flex flex-col gap-4 border-2 border-ink p-4">
                {today.length > 0 ? (
                  today.map((p) => (
                    <ProgressRow
                      key={p.projectId}
                      title={p.projectTitle}
                      label={`${p.done}/${p.total} · ${p.percent}% done`}
                      progress={p.percent}
                    />
                  ))
                ) : (
                  <p className="text-sm text-ink-muted">Nothing planned for today yet.</p>
                )}
              </Card>
            </div>

            <div>
              <SectionHeader
                title="Longterm goals"
                action={
                  <button onClick={() => setTab("crumbs")} className="flex items-center gap-0.5 text-ink-muted">
                    Details
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                }
              />
              <div className="mt-2 grid grid-cols-2 gap-3">
                {longterm.length > 0 ? (
                  longterm.map((g, i) => (
                    <button
                      key={g.projectId}
                      onClick={() => {
                        openProjectSession(g.projectId, g.projectTitle);
                        setChatOpen(true);
                      }}
                      className="text-left"
                    >
                      <Card className="flex flex-col gap-2 bg-gradient-to-b from-bg to-accent p-3">
                        <div className="flex items-center justify-between">
                          <PlayCircle className="h-9 w-9 text-accent-deep" strokeWidth={1.5} />
                          <img
                            src={i % 2 === 0 ? "/mascot/goal-1.png" : "/mascot/goal-2.png"}
                            alt=""
                            className="h-11 w-11 object-contain"
                          />
                        </div>
                        <div>
                          <p className="truncate text-sm font-bold text-ink">{g.projectTitle}</p>
                          <p className="text-xs font-light text-ink-muted">Next step · {g.nextStepMinutes} min</p>
                        </div>
                      </Card>
                    </button>
                  ))
                ) : (
                  <Card className="col-span-2 p-3 text-center text-sm text-ink-muted">
                    No longterm goals yet.
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {tab === "calendar" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <Calendar />
        </main>
      )}

      {tab === "crumbs" && (
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <CrumbStack />
        </main>
      )}

      {tab === "profile" && (
        <main className="min-h-0 flex-1 overflow-y-auto">
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
              <span className={clsx("text-xs", active ? "font-bold text-ink" : "font-normal text-ink/40")}>
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
    </div>
  );
}
