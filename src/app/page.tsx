"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import CrumbStack from "@/components/CrumbStack";

// FullCalendar touches window/document — load client-side only.
const Calendar = dynamic(() => import("@/components/Calendar"), { ssr: false });

type Tab = "crumbs" | "calendar";

export default function Home() {
  const [tab, setTab] = useState<Tab>("crumbs");
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="mx-auto flex h-screen w-full max-w-[430px] flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h1 className="text-lg font-semibold">
          Crumbles <span className="font-normal text-neutral-400">— Convert intentions to actions.</span>
        </h1>
      </header>

      <nav className="flex gap-1 border-b border-black/10 px-4 pt-2 dark:border-white/10">
        {(["crumbs", "calendar"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            }`}
          >
            {t === "crumbs" ? "Crumbs" : "Calendar"}
          </button>
        ))}
      </nav>

      <main className="relative min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "crumbs" ? (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Up next</h2>
            <CrumbStack />
          </div>
        ) : (
          <div className="h-full">
            <Calendar />
          </div>
        )}
      </main>

      <div
        className="flex justify-center border-t border-black/10 py-3 dark:border-white/10"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Break down a new goal"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-50 dark:bg-neutral-950">
          <ChatPanel onClose={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  );
}
