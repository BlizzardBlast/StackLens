import type { RepositoryAnalysisProgressStage } from "./repository-analysis-api.js";

const ACTIVE_PROGRESS_STAGES = [
  "queued",
  "resolving_repository",
  "collecting_snapshot",
  "collecting_metadata",
  "running_rules",
  "scoring",
] as const satisfies readonly RepositoryAnalysisProgressStage[];

const stageContent: Record<
  (typeof ACTIVE_PROGRESS_STAGES)[number],
  { readonly label: string; readonly detail: string }
> = {
  queued: {
    label: "Queued",
    detail: "Waiting for an analysis worker.",
  },
  resolving_repository: {
    label: "Resolving repository",
    detail: "Resolving the public repository to an immutable revision.",
  },
  collecting_snapshot: {
    label: "Collecting snapshot",
    detail: "Reading the bounded supported project snapshot without executing repository code.",
  },
  collecting_metadata: {
    label: "Collecting package metadata",
    detail: "Collecting bounded npm and vulnerability metadata for supported dependencies.",
  },
  running_rules: {
    label: "Running rules",
    detail: "Running deterministic analysis rules against the collected evidence.",
  },
  scoring: {
    label: "Calculating health score",
    detail: "Applying the versioned scoring policy to evidence-backed findings.",
  },
};

type ActiveProgressStage = (typeof ACTIVE_PROGRESS_STAGES)[number];

function isActiveProgressStage(
  stage: RepositoryAnalysisProgressStage,
): stage is ActiveProgressStage {
  return ACTIVE_PROGRESS_STAGES.some((activeStage) => activeStage === stage);
}

export interface AnalysisProgressProps {
  readonly repositoryUrl: string;
  readonly stage: RepositoryAnalysisProgressStage;
}

export function AnalysisProgress({ repositoryUrl, stage }: Readonly<AnalysisProgressProps>) {
  const currentIndex = isActiveProgressStage(stage) ? ACTIVE_PROGRESS_STAGES.indexOf(stage) : 0;
  const currentStage = ACTIVE_PROGRESS_STAGES[currentIndex] ?? "queued";

  return (
    <section
      aria-labelledby="analysis-progress-title"
      className="grid gap-6 rounded-xl border bg-card p-5 text-card-foreground sm:p-6"
    >
      <div className="grid gap-2">
        <p className="font-mono text-xs break-all text-muted-foreground">{repositoryUrl}</p>
        <h1 id="analysis-progress-title" className="text-2xl font-semibold tracking-tight">
          Analyzing repository
        </h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {stageContent[currentStage].detail}
        </p>
      </div>

      <ol className="grid gap-3" aria-label="Analysis stages">
        {ACTIVE_PROGRESS_STAGES.map((progressStage, index) => {
          const status =
            index < currentIndex ? "Complete" : index === currentIndex ? "Current" : "Pending";

          return (
            <li key={progressStage} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className={
                  index <= currentIndex
                    ? "grid size-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary"
                    : "grid size-7 shrink-0 place-items-center rounded-full border text-muted-foreground"
                }
              >
                {index < currentIndex ? "✓" : index + 1}
              </span>
              <span className={index === currentIndex ? "font-semibold" : undefined}>
                {stageContent[progressStage].label}
              </span>
              <span className="sr-only"> — {status}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
