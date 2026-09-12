"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Home as HomeIcon, CalendarDays, Cookie } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CrumbStack from "@/components/CrumbStack";
import CrumbReview from "@/components/CrumbReview";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeader from "@/components/ui/SectionHeader";
import ProgressRow from "@/components/ui/ProgressRow";
import { useCalendarStore } from "@/lib/store";
import { durationMinutes, longtermGoals, nextUpEvent, projectsToday, stepCount } from "@/lib/selectors";

// FullCalendar touches window/document — load client-side only.
const Calendar = dynamic(() => import("@/components/Calendar"), { ssr: false });

type Tab = "home" | "calendar" | "crumbs";

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
  const nextUpRef = useRef<HTMLDivElement>(null);

  const events = useCalendarStore((s) => s.events);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const reviewActive = useCalendarStore((s) => s.reviewActive);

  const next = useMemo(() => nextUpEvent(events), [events]);
  const today = useMemo(() => projectsToday(events), [events]);
  const longterm = useMemo(() => longtermGoals(events), [events]);

  // No `status` field exists on CalendarEvent, so "completing" a crumb here reuses the
  // store's existing updateEvent action to stamp its end just before now — the same
  // isDone cutoff every progress number and CrumbStack already key off of. Backdating
  // by a second (rather than using "now" exactly) avoids a same-tick race where the
  // re-render's own isDone check runs at the same millisecond as this write.
  const crumbItDone = (id: string) => updateEvent(id, { end: new Date(Date.now() - 1000).toISOString() });

  return (
    <div className="mx-auto flex h-screen w-full max-w-[430px] flex-col bg-bg">
      {tab === "home" && (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <header className="flex items-center gap-3 px-4 pt-4 pb-2">
            <img src="/crumble.svg" alt="" className="h-11 w-11 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-heading truncate text-lg font-semibold text-ink">
                {greeting(new Date())}, {USER_NAME}
              </h1>
              <p className="text-sm text-ink-muted">Welcome back!</p>
            </div>
          </header>

          <div className="flex flex-col gap-5 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                onClick={() => setChatOpen(true)}
                className="!h-auto !justify-start !rounded-card !py-3 text-left"
              >
                Add new task
              </Button>
              <Button
                variant="secondary"
                onClick={() => nextUpRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="!h-auto !justify-start !rounded-card !py-3 text-left"
              >
                Continue where you left
              </Button>
            </div>

            <div ref={nextUpRef}>
              {next ? (
                <Card className="flex flex-col gap-3 bg-accent p-5">
                  <h2 className="font-heading text-xl font-bold text-ink">Next up for you</h2>
                  <div>
                    <p className="text-sm font-medium text-ink">{timeFormatter.format(new Date(next.start))}</p>
                    <p className="text-sm text-ink">
                      {next.title}
                      {next.projectId ? ` · ${stepCount(events, next.projectId)} step action` : ""}
                    </p>
                  </div>
                  <div className="flex items-end justify-between">
                    <Button onClick={() => crumbItDone(next.id)}>Crumb it!</Button>
                    <p className="text-xs text-ink-muted">Time ~{durationMinutes(next)}min</p>
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
                  <button onClick={() => setTab("calendar")} className="text-ink-muted">
                    Full calendar »
                  </button>
                }
              />
              <Card className="mt-2 flex flex-col gap-4 p-4">
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
                  <button onClick={() => setTab("crumbs")} className="text-ink-muted">
                    Details
                  </button>
                }
              />
              <div className="mt-2 grid grid-cols-2 gap-3">
                {longterm.length > 0 ? (
                  longterm.map((g) => (
                    <Card key={g.projectId} className="p-3">
                      <p className="truncate text-sm font-medium text-ink">{g.projectTitle}</p>
                      <p className="text-xs text-ink-muted">Next step · {g.nextStepMinutes} min</p>
                    </Card>
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

      <nav
        className="flex justify-around border-t border-ink/10 bg-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {(
          [
            { key: "home", label: "Home", Icon: HomeIcon },
            { key: "calendar", label: "Calendar", Icon: CalendarDays },
            { key: "crumbs", label: "My crumbs", Icon: Cookie },
          ] as const
        ).map(({ key, label, Icon }) => (
          <Button
            key={key}
            variant={tab === key ? "secondary" : "ghost"}
            onClick={() => setTab(key)}
            className="!h-auto !flex-1 !flex-col !gap-0.5 !rounded-none !py-2 text-xs"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Button>
        ))}
      </nav>

      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-bg">
          <ChatPanel onClose={() => setChatOpen(false)} />
        </div>
      )}

      {/* Full-screen takeover: swiping through a goal's crumbs replaces the whole app
          until the user commits them (or discards) — see CrumbReview for why. */}
      {reviewActive && <CrumbReview />}
    </div>
  );
}
