"use client";

import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { EventResizeDoneArg } from "@fullcalendar/interaction";
import { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import clsx from "clsx";
import { useCalendarStore } from "@/lib/store";
import { CalendarEvent } from "@/types/event";
import EventModal, { EventDraft } from "./EventModal";

type ModalState =
  | { mode: "create"; initial: { start: string; end: string } }
  | { mode: "edit"; initial: CalendarEvent }
  | null;

// FullCalendar's own headerToolbar crams nav/title/view-switcher into one row sized for
// desktop, which overflows on the app's fixed phone-width column. headerToolbar is
// disabled below and replaced with this custom two-row header instead: arrows+title+today
// on top, an even full-width view switcher underneath.
const VIEWS = [
  { key: "timeGridDay", label: "Day" },
  { key: "timeGridWeek", label: "Week" },
  { key: "dayGridMonth", label: "Month" },
  { key: "listWeek", label: "List" },
] as const;

export default function Calendar() {
  const events = useCalendarStore((s) => s.events);
  const addEvents = useCalendarStore((s) => s.addEvents);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const removeEvent = useCalendarStore((s) => s.removeEvent);
  const [modal, setModal] = useState<ModalState>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState<string>("timeGridDay");

  // Fallback for standalone events with no project color assigned — a soft tan pulled
  // from the same palette as PROJECT_COLORS in api/chat/route.ts.
  const FALLBACK_EVENT_COLOR = "#f6c98a";

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: e.color ?? FALLBACK_EVENT_COLOR,
    borderColor: e.color ?? FALLBACK_EVENT_COLOR,
    // Soft pastel backgrounds read poorly with FullCalendar's default white event text.
    textColor: "#6b3f24",
    // Faded + struck through once ExecutionScreen marks a step done, instead of removing
    // it outright — keeps the calendar an honest record of what happened.
    classNames: e.status === "done" ? ["crumb-task-done"] : [],
  }));

  const handleDrop = (arg: EventDropArg) => {
    updateEvent(arg.event.id, {
      start: arg.event.start?.toISOString() ?? "",
      end: (arg.event.end ?? arg.event.start)?.toISOString() ?? "",
    });
  };

  const handleResize = (arg: EventResizeDoneArg) => {
    updateEvent(arg.event.id, {
      start: arg.event.start?.toISOString() ?? "",
      end: (arg.event.end ?? arg.event.start)?.toISOString() ?? "",
    });
  };

  const handleEventClick = (arg: EventClickArg) => {
    const found = events.find((e) => e.id === arg.event.id);
    if (found) setModal({ mode: "edit", initial: found });
  };

  const handleSelect = (arg: DateSelectArg) => {
    setModal({ mode: "create", initial: { start: arg.start.toISOString(), end: arg.end.toISOString() } });
  };

  const handleNewEventClick = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setModal({ mode: "create", initial: { start: start.toISOString(), end: end.toISOString() } });
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    setView(arg.view.type);
  };

  const closeModal = () => setModal(null);

  const handleSave = (data: EventDraft) => {
    if (data.id) {
      updateEvent(data.id, data);
    } else {
      addEvents([{ ...data, id: crypto.randomUUID() }]);
    }
    closeModal();
  };

  const handleDelete = () => {
    if (modal?.mode === "edit") removeEvent(modal.initial.id);
    closeModal();
  };

  return (
    <div className="rounded-card border border-ink/10 bg-bg shadow-card flex h-full flex-col gap-2 p-3">
      <div className="flex justify-end">
        <button
          onClick={handleNewEventClick}
          className="flex items-center gap-1 rounded-md border border-ink/10 px-2 py-1 text-xs text-ink hover:bg-ink/5"
        >
          <Plus className="h-3.5 w-3.5" /> New event
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => calendarRef.current?.getApi().prev()}
              aria-label="Previous"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink hover:bg-ink/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => calendarRef.current?.getApi().next()}
              aria-label="Next"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink hover:bg-ink/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink">{title}</p>
          <button
            onClick={() => calendarRef.current?.getApi().today()}
            className="shrink-0 text-xs font-medium text-ink-muted hover:text-ink"
          >
            Today
          </button>
        </div>

        <div className="flex gap-1 rounded-lg bg-ink/5 p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => calendarRef.current?.getApi().changeView(v.key)}
              className={clsx(
                "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                view === v.key ? "bg-ink text-bg" : "text-ink-muted hover:text-ink"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="crumbles-calendar min-h-0 flex-1">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridDay"
          headerToolbar={false}
          datesSet={handleDatesSet}
          editable
          selectable
          selectMirror
          droppable
          select={handleSelect}
          eventClick={handleEventClick}
          eventDrop={handleDrop}
          eventResize={handleResize}
          events={fcEvents}
          height="100%"
          nowIndicator
          firstDay={1}
        />
      </div>

      {modal && (
        <EventModal
          mode={modal.mode}
          initial={modal.initial}
          onSave={handleSave}
          onDelete={modal.mode === "edit" ? handleDelete : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
