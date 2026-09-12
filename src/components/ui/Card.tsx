import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export default function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // cn (tailwind-merge, not plain clsx) so a conflicting utility passed via
      // `className` — e.g. `bg-accent` overriding the default `bg-surface` — reliably
      // wins. Tailwind doesn't order generated CSS by class-string order, so two
      // same-property utilities in one string is a silent toss-up without this.
      className={cn("rounded-card border border-black/10 bg-white shadow-card", className)}
      {...props}
    />
  );
}
