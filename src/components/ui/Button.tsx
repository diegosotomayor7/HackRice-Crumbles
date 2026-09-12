import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:opacity-90",
  secondary: "bg-accent text-ink hover:opacity-90",
  ghost: "bg-transparent text-ink hover:bg-ink/10",
  // Black-bordered pill on a light fill — the "Crumb it!" treatment from the Homepage UI design.
  outline: "border-2 border-black bg-bg text-black font-bold hover:bg-black/5",
};

export default function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
