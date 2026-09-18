import { EvidenceCoverage } from "#domain/evidence-coverage";
import { cn } from "#lib/utils";

export type HealthScoreState = "excellent" | "good" | "watch" | "poor" | "unknown";

type KnownHealthScoreProps = {
  score: number;
  state: Exclude<HealthScoreState, "unknown">;
  coveragePercent: number;
  label?: string;
  detail?: string;
  className?: string;
};

type UnknownHealthScoreProps = {
  score: null;
  state: "unknown";
  coveragePercent: number;
  label?: string;
  detail: string;
  className?: string;
};

export type HealthScoreProps = KnownHealthScoreProps | UnknownHealthScoreProps;

const stateClassName: Record<HealthScoreState, string> = {
  excellent: "border-score-excellent text-score-excellent",
  good: "border-score-good text-score-good",
  watch: "border-score-watch text-score-watch",
  poor: "border-score-poor text-score-poor",
  unknown: "border-score-unknown text-score-unknown",
};

export function HealthScore({
  score,
  state,
  coveragePercent,
  label = "Stack health",
  detail,
  className,
}: HealthScoreProps) {
  const displayScore = score === null ? "N/A" : String(Math.max(0, Math.min(100, score)));

  return (
    <section
      className={cn(
        "grid gap-5 rounded-xl border bg-card p-5 text-card-foreground md:grid-cols-[auto_1fr]",
        className,
      )}
      aria-label={label}
    >
      <div
        className={cn(
          "grid size-24 place-content-center rounded-full border-8 bg-background text-center",
          stateClassName[state],
        )}
      >
        <strong className="text-3xl leading-none text-foreground">{displayScore}</strong>
        {score === null ? null : <span className="text-xs text-muted-foreground">/100</span>}
      </div>
      <div className="grid content-center gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold">{label}</h2>
          {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
        </div>
        <EvidenceCoverage percent={coveragePercent} />
      </div>
    </section>
  );
}
