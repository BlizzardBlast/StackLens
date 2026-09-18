import { cn } from "#lib/utils";

export interface EvidenceCoverageProps {
  percent: number;
  className?: string;
  detail?: string;
}

export function EvidenceCoverage({ percent, className, detail }: EvidenceCoverageProps) {
  const boundedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Evidence coverage
        </span>
        <strong>{boundedPercent}%</strong>
      </div>
      <progress className="sr-only" aria-label="Evidence coverage" max={100} value={boundedPercent}>
        {boundedPercent}%
      </progress>
      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${boundedPercent}%` }} />
      </div>
      {detail ? <p className="m-0 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
