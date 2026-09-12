"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Trash2, X } from "lucide-react";
import clsx from "clsx";
import { usePlan } from "@/hooks/usePlan";
import { useAgent } from "@/hooks/useAgent";
import { useBlockerChips } from "@/hooks/useBlockerChips";
import ExecutionProgressBar from "@/components/execution/ExecutionProgressBar";
import StepCard from "@/components/execution/StepCard";
import BlockerChips from "@/components/execution/BlockerChips";
import AgentInputBar from "@/components/execution/AgentInputBar";

const HIGHLIGHT_MS = 1600;

export default function ExecutionScreen({ projectId, onExit }: { projectId: string; onExit: () => void }) {
  const plan = usePlan(projectId);
  const { send, pending, ephemeral } = useAgent(plan);
  const [input, setInput] = useState("");
  const [scopeCleared, setScopeCleared] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const prevIds = useRef<Set<string>>(new Set(plan.tasks.map((t) => t.id)));
  useEffect(() => {
    const currentIds = new Set(plan.tasks.map((t) => t.id));
    const added = [...currentIds].filter((id) => !prevIds.current.has(id));
    prevIds.current = currentIds;
    if (added.length === 0) return;
    setHighlightedIds(new Set(added));
    const timer = setTimeout(() => setHighlightedIds(new Set()), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.tasks.map((t) => t.id).join(",")]);

  const pendingTasks = plan.tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const doneCount = plan.tasks.length - pendingTasks.length;
  const current = pendingTasks[0];
  const upcoming = pendingTasks.slice(1, 3);
  const currentIndex = current ? plan.tasks.findIndex((t) => t.id === current.id) : -1;

  const scopedTaskId = scopeCleared ? undefined : current?.id;

  const submit = (text: string) => {
    if (!text.trim() || pending) return;
    send(text, scopedTaskId);
    setInput("");
  };

  const deleteGoal = () => {
    plan.deleteTasks(plan.tasks.map((t) => t.id));
    onExit();
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b-2 border-black px-4 py-3">
        {confirmingDelete ? (
          <>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-black">Delete this goal and its steps?</p>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="shrink-0 rounded-full border-2 border-black px-3 py-1.5 text-xs font-bold text-black hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              onClick={deleteGoal}
              className="shrink-0 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <h1 className="font-heading min-w-0 flex-1 truncate text-xl font-bold text-black">{plan.projectTitle}</h1>
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete goal"
              title="Delete this goal"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black text-black hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onExit}
              aria-label="Exit"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black text-black hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </header>

      <div className="px-4 pt-3">
        <ExecutionProgressBar total={plan.tasks.length} doneCount={doneCount} />
      </div>

      <div className="hide-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {current ? (
          <>
            <div className="relative">
              {upcoming[1] && (
                <div className="scale-[0.94] opacity-0">
                  <StepCard task={upcoming[1]} stepNumber={0} totalSteps={0} peek />
                </div>
              )}
              {upcoming[0] && <StepCard task={upcoming[0]} stepNumber={0} totalSteps={0} peek />}
              <AnimatePresence mode="popLayout">
                <StepCard
                  key={current.id}
                  task={current}
                  stepNumber={currentIndex + 1}
                  totalSteps={plan.tasks.length}
                  highlighted={highlightedIds.has(current.id)}
                  busy={pending}
                  onSwipeRight={() => plan.setTaskStatus(current.id, "done")}
                  onSwipeLeft={() => send(`Break "${current.title}" down into smaller steps.`, current.id)}
                />
              </AnimatePresence>
            </div>
            {upcoming[0] && <p className="text-sm text-black/50">Next: {upcoming[0].title}</p>}

            <BlockerChipsSection taskId={current.id} title={current.title} detail={current.notes} onSelect={submit} disabled={pending} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="text-2xl">🎉</span>
            <p className="font-heading text-lg font-bold text-black">All steps done!</p>
          </div>
        )}
      </div>

      {ephemeral && (
        <div className="px-4 pb-1">
          <p className={clsx("text-xs font-medium", ephemeral.kind === "error" ? "text-red-500" : "text-accent-deep")}>
            {ephemeral.text}
          </p>
        </div>
      )}

      <AgentInputBar
        value={input}
        onChange={setInput}
        onSubmit={() => submit(input)}
        disabled={pending}
        scopeLabel={current && !scopeCleared ? `↳ Step ${currentIndex + 1}` : undefined}
        onClearScope={() => setScopeCleared(true)}
      />
    </div>
  );
}

function BlockerChipsSection({
  taskId,
  title,
  detail,
  onSelect,
  disabled,
}: {
  taskId: string;
  title: string;
  detail?: string;
  onSelect: (label: string) => void;
  disabled: boolean;
}) {
  const chips = useBlockerChips(taskId, title, detail);
  return <BlockerChips chips={chips} onSelect={onSelect} disabled={disabled} />;
}
