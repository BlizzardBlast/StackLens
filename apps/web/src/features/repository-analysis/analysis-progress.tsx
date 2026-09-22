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
  { readonly label: string; readonly detail: string; readonly shortDetail: string }
> = {
  queued: {
    label: "Queued",
    detail: "Waiting for an analysis worker to claim this repository.",
    shortDetail: "Waiting for a worker",
  },
  resolving_repository: {
    label: "Resolving repository",
    detail: "Resolving the public repository to an immutable revision for reproducible analysis.",
    shortDetail: "Pinning an immutable revision",
  },
  collecting_snapshot: {
    label: "Collecting snapshot",
    detail: "Reading the bounded supported project snapshot without executing repository code.",
    shortDetail: "Reading supported project files",
  },
  collecting_metadata: {
    label: "Collecting package metadata",
    detail: "Collecting bounded npm and vulnerability metadata for supported dependencies.",
    shortDetail: "Checking supported package evidence",
  },
  running_rules: {
    label: "Running rules",
    detail: "Running deterministic analysis rules against the evidence collected so far.",
    shortDetail: "Evaluating evidence-backed rules",
  },
  scoring: {
    label: "Calculating health score",
    detail: "Applying the versioned scoring policy to supported evidence and finalized findings.",
    shortDetail: "Building the report summary",
  },
};

type ActiveProgressStage = (typeof ACTIVE_PROGRESS_STAGES)[number];

function isActiveProgressStage(
  stage: RepositoryAnalysisProgressStage,
): stage is ActiveProgressStage {
  return ACTIVE_PROGRESS_STAGES.some((activeStage) => activeStage === stage);
}

function repositoryLabel(repositoryUrl: string): string {
  try {
    const url = new URL(repositoryUrl);
    const segments = url.pathname.split("/").filter(Boolean);

    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1]?.replace(/\.git$/u, "") ?? ""}`;
    }
  } catch {
    return repositoryUrl;
  }

  return repositoryUrl;
}

export interface AnalysisProgressProps {
  readonly repositoryUrl: string;
  readonly stage: RepositoryAnalysisProgressStage;
}

export function AnalysisProgress({ repositoryUrl, stage }: Readonly<AnalysisProgressProps>) {
  const currentIndex = isActiveProgressStage(stage) ? ACTIVE_PROGRESS_STAGES.indexOf(stage) : 0;
  const currentStage = ACTIVE_PROGRESS_STAGES[currentIndex] ?? "queued";
  const currentContent = stageContent[currentStage];

  return (
    <section
      aria-labelledby="analysis-progress-title"
      className="overflow-hidden rounded-2xl border bg-card text-card-foreground"
    >
      <div className="border-b bg-muted/25 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-semibold">
                <span
                  aria-hidden="true"
                  className="size-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                />
                Analysis in progress
              </span>
              <span className="font-mono text-xs text-muted-foreground">Live status</span>
            </div>

            <div className="grid gap-1">
              <p className="font-mono text-sm break-all text-muted-foreground">
                {repositoryLabel(repositoryUrl)}
              </p>
              <h1
                id="analysis-progress-title"
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
              >
                Analyzing repository
              </h1>
            </div>
          </div>

          <div className="rounded-lg border bg-background px-3 py-2 text-right">
            <p className="text-xs font-medium text-muted-foreground">Current stage</p>
            <p className="mt-0.5 text-sm font-semibold">{currentContent.label}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,1.1fr)] lg:gap-10">
        <div className="grid content-start gap-5">
          <div
            aria-live="polite"
            aria-atomic="true"
            className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5"
          >
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              Now working
            </p>
            <div className="grid gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{currentContent.label}</h2>
              <output className="text-sm leading-6 text-muted-foreground">
                {currentContent.detail}
              </output>
            </div>
          </div>

          <div className="grid gap-2 border-l pl-4">
            <p className="text-sm font-semibold">Status updates automatically</p>
            <p className="text-sm leading-6 text-muted-foreground">
              StackLens reports real analysis stages from the worker. It does not invent a
              percentage when the backend cannot measure one reliably.
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Safe static inspection</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Repository code, package scripts, builds, tests, hooks, and dependency installation
              are not executed during this analysis.
            </p>
          </div>
        </div>

        <ol className="grid content-start gap-1" aria-label="Analysis stages">
          {ACTIVE_PROGRESS_STAGES.map((progressStage, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <li
                key={progressStage}
                aria-current={isCurrent ? "step" : undefined}
                className={
                  isCurrent
                    ? "relative grid grid-cols-[2rem_1fr] gap-3 overflow-hidden rounded-xl border border-primary/25 bg-primary/5 p-3"
                    : "grid grid-cols-[2rem_1fr] gap-3 rounded-xl p-3"
                }
              >
                {isCurrent ? (
                  <span
                    aria-hidden="true"
                    data-progress-activity=""
                    className="pointer-events-none absolute inset-0 animate-pulse bg-primary/10 motion-reduce:animate-none"
                  />
                ) : null}

                <span
                  aria-hidden="true"
                  className={
                    isComplete
                      ? "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm leading-none font-semibold text-primary-foreground tabular-nums"
                      : isCurrent
                        ? "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background text-sm leading-none font-semibold text-primary tabular-nums ring-4 ring-primary/10"
                        : "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm leading-none font-medium text-muted-foreground tabular-nums"
                  }
                >
                  {isComplete ? "✓" : index + 1}
                </span>

                <div className="relative z-10 grid min-w-0 gap-0.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={isCurrent ? "text-sm font-semibold" : "text-sm font-medium"}>
                      {stageContent[progressStage].label}
                    </span>
                    <span className="text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
                      {isComplete ? "Done" : isCurrent ? "In progress" : "Waiting"}
                    </span>
                  </div>
                  <p
                    className={
                      isCurrent
                        ? "text-xs leading-5 text-muted-foreground"
                        : "text-xs leading-5 text-muted-foreground/80"
                    }
                  >
                    {stageContent[progressStage].shortDetail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
