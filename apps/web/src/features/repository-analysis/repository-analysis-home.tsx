import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { RepositoryAnalysisApiError, repositoryAnalysisClient } from "./repository-analysis-api.js";
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

const capabilities = [
  {
    eyebrow: "Static by design",
    title: "No project execution",
    detail: "StackLens inspects supported repository evidence without installing or running project code.",
  },
  {
    eyebrow: "Traceable",
    title: "Evidence-backed findings",
    detail: "Findings keep their rule identity and supporting project or provider evidence visible.",
  },
  {
    eyebrow: "Deterministic",
    title: "Versioned analysis",
    detail: "Rules and scoring stay explicit so the same supported evidence can be explained.",
  },
] as const;

export function RepositoryAnalysisHome() {
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: (repositoryUrl: string) => repositoryAnalysisClient.submitRepository(repositoryUrl),
  });

  async function handleSubmit(repositoryUrl: string): Promise<void> {
    const { analysisId } = await mutation.mutateAsync(repositoryUrl);
    await navigate({
      to: "/analyses/$analysisId",
      params: { analysisId },
    });
  }

  const mutationError = errorMessage(mutation.error);

  return (
    <main className="relative isolate min-h-[calc(100dvh-73px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-linear-to-b from-primary/8 via-primary/3 to-transparent"
      />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:gap-14 lg:py-20">
        <section className="grid gap-8">
          <div className="grid max-w-3xl gap-5">
            <div className="flex">
              <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
                Repository analysis
              </span>
            </div>

            <div className="grid gap-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
                Understand what is actually happening in your development stack.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                StackLens turns supported repository evidence into deterministic findings, health
                signals, and recommendations you can trace back to their source.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3" aria-label="Analysis principles">
            {capabilities.map((capability) => (
              <article key={capability.title} className="grid content-start gap-2 border-l pl-4">
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  {capability.eyebrow}
                </p>
                <h2 className="text-sm font-semibold">{capability.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{capability.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-card/95 p-5 text-card-foreground shadow-sm backdrop-blur sm:p-7">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Start an analysis
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">Inspect a public repository</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Paste a GitHub repository URL. StackLens will resolve an immutable revision, collect
                bounded evidence, run its rules, and build the report.
              </p>
            </div>

            <RepositoryAnalysisForm
              onSubmit={handleSubmit}
              isPending={mutation.isPending}
              {...(mutationError === undefined ? {} : { serverError: mutationError })}
            />
          </div>
        </section>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-5 text-xs text-muted-foreground">
          <span>No account required</span>
          <span aria-hidden="true">·</span>
          <span>Public repositories only</span>
          <span aria-hidden="true">·</span>
          <span>No dependency installation or project code execution</span>
        </div>
      </div>
    </main>
  );
}
