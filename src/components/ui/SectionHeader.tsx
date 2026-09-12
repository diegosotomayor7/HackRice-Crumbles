import { ReactNode } from "react";

export default function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-heading text-base font-semibold text-black">{title}</h2>
      {action && <span className="text-sm text-black/60">{action}</span>}
    </div>
  );
}
