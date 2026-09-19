import { cn } from "cn";
import type { ReactNode } from "react";

export interface AnalysisLimitationProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function AnalysisLimitation({ title, children, className }: AnalysisLimitationProps) {
  return (
    <aside
      role="note"
      className={cn(
        "flex gap-3 rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-warning/15 font-bold text-warning"
      >
        !
      </span>
      <div>
        <strong>{title}</strong>
        <div className="mt-1 text-muted-foreground">{children}</div>
      </div>
    </aside>
  );
}
