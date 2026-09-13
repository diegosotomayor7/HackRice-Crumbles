"use client";

import { Send, X } from "lucide-react";

// Dumb presentational bottom bar shared by ExecutionScreen (and, later, PlanScreen). The
// scope chip ("↳ Step 3") shows which task a message will be attached to — see the
// TASK-SCOPED INPUT mechanic: this screen implicitly scopes to the current step by default.
export type AgentInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  scopeLabel?: string;
  onClearScope?: () => void;
  placeholder?: string;
};

export default function AgentInputBar({
  value,
  onChange,
  onSubmit,
  disabled,
  scopeLabel,
  onClearScope,
  placeholder = "Or other questions...",
}: AgentInputBarProps) {
  return (
    <div className="flex flex-col gap-1.5 border-t-2 border-black bg-white p-3">
      {scopeLabel && (
        <div className="flex w-fit items-center gap-1 rounded-full bg-accent/60 px-2.5 py-1 text-xs font-medium text-black">
          <span>{scopeLabel}</span>
          {onClearScope && (
            <button onClick={onClearScope} aria-label="Clear scope" className="text-black/50 hover:text-black">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-full border border-black/20 bg-white px-3.5 py-2 text-sm text-black outline-none focus:border-black disabled:opacity-60"
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-deep text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
