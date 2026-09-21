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
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <section className="rounded-xl border bg-card p-5" aria-live="polite">
          <p className="text-sm text-muted-foreground">Loading analysis status…</p>
        </section>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-10 sm:px-6">
        <section className="grid gap-4 rounded-xl border bg-card p-5" role="alert">
          <div>
            <h1 className="text-xl font-semibold">Analysis status unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{queryErrorMessage(query.error)}</p>
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
              New analysis
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Analysis navigation">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/35"
        >
          ← New analysis
        </Link>
      </nav>
      <AnalysisStatusView snapshot={query.data} />
    </div>
  );
}
