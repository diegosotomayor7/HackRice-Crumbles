"use client";

// Sends one message to /api/agent, applies the single tool call it returns against a Plan
// (see usePlan), and surfaces the result as the ephemeral line above the input bar. This is
// the only place that talks to /api/agent — ExecutionScreen and blocker chips both go through
// `send`, so typing a message and tapping a chip behave identically.

import { useCallback, useRef, useState } from "react";
import { Plan } from "./usePlan";

type AgentArgs = Record<string, unknown>;

export type EphemeralState = { text: string; kind: "info" | "error" } | null;

export function useAgent(plan: Plan) {
  const [pending, setPending] = useState(false);
  const [ephemeral, setEphemeral] = useState<EphemeralState>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showEphemeral = useCallback((text: string, kind: "info" | "error") => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setEphemeral({ text, kind });
    dismissTimer.current = setTimeout(() => setEphemeral(null), 3000);
  }, []);

  const applyTool = useCallback(
    (tool: string, args: AgentArgs): string => {
      switch (tool) {
        case "add_tasks":
          return plan.addTasks(
            (args.tasks as { title: string; detail?: string; estimateMinutes?: number }[]) ?? [],
            args.afterTaskId as string | undefined
          );
        case "update_task":
          return plan.updateTask(args.id as string, {
            title: args.title as string | undefined,
            detail: args.detail as string | undefined,
            estimateMinutes: args.estimateMinutes as number | undefined,
          });
        case "delete_tasks":
          return plan.deleteTasks((args.ids as string[]) ?? []);
        case "split_task":
          return plan.splitTask(
            args.id as string,
            (args.into as { title: string; detail?: string; estimateMinutes?: number }[]) ?? []
          );
        case "reorder_tasks":
          return plan.reorderTasks((args.orderedIds as string[]) ?? []);
        case "reply_only":
        default:
          return (args.message as string) ?? "Got it.";
      }
    },
    [plan]
  );

  const send = useCallback(
    async (message: string, scopedTaskId?: string) => {
      setPending(true);
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            plan: { projectTitle: plan.projectTitle, tasks: plan.tasks.map((t) => ({ id: t.id, title: t.title })) },
            scopedTaskId,
          }),
        });
        const data = (await res.json()) as { tool: string; args: AgentArgs };
        const summary = applyTool(data.tool, data.args);
        showEphemeral(summary, "info");
      } catch {
        showEphemeral("Couldn't reach the agent. Try again.", "error");
      } finally {
        setPending(false);
      }
    },
    [plan, applyTool, showEphemeral]
  );

  return { send, pending, ephemeral };
}
