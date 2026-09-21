import { Link } from "@tanstack/react-router";

import type { RepositoryAnalysisSnapshot } from "./repository-analysis-api.js";
import { AnalysisProgress } from "./analysis-progress.js";
import { AnalysisReportView } from "./analysis-report-view.js";

export interface AnalysisStatusViewProps {
  readonly snapshot: RepositoryAnalysisSnapshot;
}

export function AnalysisStatusView({ snapshot }: Readonly<AnalysisStatusViewProps>) {
  if (snapshot.status === "failed") {
    return (
      <section className="grid gap-5 rounded-xl border bg-card p-5" role="alert">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-destructive">Analysis failed</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            The repository could not be analyzed
          </h1>
          <p className="text-sm text-muted-foreground">
            {snapshot.failure?.message ?? "StackLens could not complete this repository analysis."}
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex min-h-11 w-fit items-center rounded-md border px-4 text-sm font-semibold outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          Start a new analysis
        </Link>
      </section>
    );
  }

  if (snapshot.status === "completed" || snapshot.status === "completed_with_limitations") {
    if (snapshot.report === undefined) {
      return (
        <section className="rounded-xl border bg-card p-5" role="alert">
          <h1 className="text-xl font-semibold">Report unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This completed analysis did not include a valid report. Try again later.
          </p>
        </section>
      );
    }

    return (
      <AnalysisReportView
        report={snapshot.report}
        completedWithLimitations={snapshot.status === "completed_with_limitations"}
      />
    );
  }

  return <AnalysisProgress repositoryUrl={snapshot.repositoryUrl} stage={snapshot.progressStage} />;
}
