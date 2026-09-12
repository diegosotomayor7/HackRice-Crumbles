"use client";

// Derives one project's ordered task list from the store and exposes the 5 agent tools
// bound to that project, so ExecutionScreen/useAgent never have to pass projectId/color
// around by hand. This is the only place components should read/mutate plan tasks.

import { useMemo } from "react";
import { useCalendarStore } from "@/lib/store";
import { getPlanTasks, TaskInput } from "@/lib/plan";
import { CalendarEvent } from "@/types/event";

export type Plan = {
  projectId: string;
  projectTitle: string;
  tasks: CalendarEvent[];
  addTasks: (tasks: TaskInput[], afterTaskId?: string) => string;
  updateTask: (id: string, patch: { title?: string; detail?: string; estimateMinutes?: number }) => string;
  deleteTasks: (ids: string[]) => string;
  splitTask: (id: string, into: TaskInput[]) => string;
  reorderTasks: (orderedIds: string[]) => string;
  setTaskStatus: (id: string, status: "pending" | "done" | "skipped") => void;
};

export function usePlan(projectId: string): Plan {
  const events = useCalendarStore((s) => s.events);
  const storeAddTasks = useCalendarStore((s) => s.addTasks);
  const storeUpdateTask = useCalendarStore((s) => s.updateTask);
  const storeDeleteTasks = useCalendarStore((s) => s.deleteTasks);
  const storeSplitTask = useCalendarStore((s) => s.splitTask);
  const storeReorderTasks = useCalendarStore((s) => s.reorderTasks);
  const storeSetTaskStatus = useCalendarStore((s) => s.setTaskStatus);

  const tasks = useMemo(() => getPlanTasks(events, projectId), [events, projectId]);
  const projectTitle = tasks[0]?.projectTitle ?? projectId;
  const color = tasks[0]?.color;

  return {
    projectId,
    projectTitle,
    tasks,
    addTasks: (t, afterTaskId) => storeAddTasks(projectId, projectTitle, color, t, afterTaskId),
    updateTask: storeUpdateTask,
    deleteTasks: storeDeleteTasks,
    splitTask: storeSplitTask,
    reorderTasks: (orderedIds) => storeReorderTasks(projectId, orderedIds),
    setTaskStatus: storeSetTaskStatus,
  };
}
