"use client";

import dynamic from "next/dynamic";
import ChatPanel from "@/components/ChatPanel";

// FullCalendar touches window/document — load client-side only.
const Calendar = dynamic(() => import("@/components/Calendar"), { ssr: false });

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h1 className="text-lg font-semibold">
          Crumble <span className="font-normal text-neutral-400">— the calendar that plans for you</span>
        </h1>
      </header>
      <main className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 md:grid-cols-[360px_1fr]">
        <div className="order-2 min-h-0 md:order-1">
          <ChatPanel />
        </div>
        <div className="order-1 min-h-0 md:order-2">
          <Calendar />
        </div>
      </main>
    </div>
  );
}
