"use client";

import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { EventResizeDoneArg } from "@fullcalendar/interaction";
import { DateSelectArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import { Plus } from "lucide-react";
import { useCalendarStore } from "@/lib/store";
import { CalendarEvent } from "@/types/event";
import EventModal, { EventDraft } from "./EventModal";

type ModalState =
  | { mode: "create"; initial: { start: string; end: string } }
  | { mode: "edit"; initial: CalendarEvent }
  | null;

export default function Calendar() {
  const events = useCalendarStore((s) => s.events);
  const addEvents = useCalendarStore((s) => s.addEvents);
  const updateEvent = useCalendarStore((s) => s.updateEvent);
  const removeEvent = useCalendarStore((s) => s.removeEvent);
  const [modal, setModal] = useState<ModalState>(null);

  const fcEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: e.color ?? "#6366f1",
    borderColor: e.color ?? "#6366f1",
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
    <div className="flex h-full flex-col gap-2 rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="flex justify-end">
        <button
          onClick={handleNewEventClick}
          className="flex items-center gap-1 rounded-md border border-black/10 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Plus className="h-3.5 w-3.5" /> New event
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
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
