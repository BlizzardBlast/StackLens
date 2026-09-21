import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@stacklens/ui/components/button";

import { AnalysisStatusView } from "./analysis-status-view.js";
import {
  RepositoryAnalysisApiError,
  isTerminalRepositoryAnalysisStatus,
  repositoryAnalysisClient,
  type RepositoryAnalysisClient,
} from "./repository-analysis-api.js";

export interface RepositoryAnalysisPageProps {
  readonly analysisId: string;
  readonly client?: RepositoryAnalysisClient;
}

function queryErrorMessage(error: unknown): string {
  if (error instanceof RepositoryAnalysisApiError) {
    return error.message;
  }

  return "StackLens could not load this analysis right now.";
}

function AnalysisNavigation() {
  return (
    <nav aria-label="Analysis navigation">
      <Link
        to="/"
        className="inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/35"
      >
        ← New analysis
      </Link>
    </nav>
  );
}

export function RepositoryAnalysisPage({
  analysisId,
  client = repositoryAnalysisClient,
}: Readonly<RepositoryAnalysisPageProps>) {
  const query = useQuery({
    queryKey: ["repository-analysis", analysisId],
    queryFn: ({ signal }) => client.getAnalysis(analysisId, signal),
    refetchInterval: (currentQuery) => {
      const snapshot = currentQuery.state.data;

      return snapshot !== undefined && isTerminalRepositoryAnalysisStatus(snapshot.status)
        ? false
        : 1500;
    },
    retry: (failureCount, error) => {
      if (error instanceof RepositoryAnalysisApiError && error.status === 404) {
        return false;
      }

      return failureCount < 2;
    },
  });

  if (query.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 sm:px-6 sm:py-10">
        <AnalysisNavigation />
        <section
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="overflow-hidden rounded-2xl border bg-card"
        >
          <div className="border-b bg-muted/25 p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-2.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
              />
              <p className="text-sm font-semibold">Preparing analysis status</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:p-7">
            <div className="grid gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Opening live analysis</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Loading the latest durable stage from StackLens. Progress will update automatically
                once the analysis state is available.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
              <div className="h-16 animate-pulse rounded-lg bg-muted/60 motion-reduce:animate-none" />
              <div className="h-16 animate-pulse rounded-lg bg-muted/45 motion-reduce:animate-none" />
              <div className="h-16 animate-pulse rounded-lg bg-muted/30 motion-reduce:animate-none" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-5 px-4 py-8 sm:px-6 sm:py-10">
        <AnalysisNavigation />
        <section className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-7" role="alert">
          <div className="grid gap-2">
            <p className="text-xs font-semibold tracking-wide text-destructive uppercase">
              Status unavailable
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Analysis could not be loaded</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {queryErrorMessage(query.error)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                void query.refetch();
              }}
            >
              Try again
            </Button>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/35"
            >
              Start another analysis
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <AnalysisNavigation />
      <AnalysisStatusView snapshot={query.data} />
    </div>
  );
}
