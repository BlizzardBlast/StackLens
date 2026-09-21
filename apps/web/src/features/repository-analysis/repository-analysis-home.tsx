import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import {
  RepositoryAnalysisApiError,
  repositoryAnalysisClient,
} from "./repository-analysis-api.js";
import { RepositoryAnalysisForm } from "./repository-analysis-form.js";

function errorMessage(error: unknown): string | undefined {
  if (error instanceof RepositoryAnalysisApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return "StackLens could not submit this repository right now.";
  }

  return undefined;
}

export function RepositoryAnalysisHome() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (repositoryUrl: string) =>
      repositoryAnalysisClient.submitRepository(repositoryUrl),
  });

  async function handleSubmit(repositoryUrl: string): Promise<void> {
    const { analysisId } = await mutation.mutateAsync(repositoryUrl);
    await navigate({
      to: "/analyses/$analysisId",
      params: { analysisId },
    });
  }

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-73px)] w-full max-w-4xl place-items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-2xl border bg-card p-6 text-card-foreground sm:p-10">
        <div className="mx-auto grid max-w-2xl gap-7">
          <div className="grid gap-3 text-center">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Repository analysis
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Understand your development stack
            </h1>
            <p className="text-muted-foreground">
              Submit a public GitHub repository for deterministic, evidence-backed analysis.
            </p>
          </div>

          <RepositoryAnalysisForm
            onSubmit={handleSubmit}
            isPending={mutation.isPending}
            serverError={errorMessage(mutation.error)}
          />
        </div>
      </section>
    </div>
  );
}
