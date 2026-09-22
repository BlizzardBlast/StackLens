import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import type { AnalysisReport } from "@stacklens/contracts";
import { Button } from "@stacklens/ui/components/button";

import { AnalysisReportView } from "../analysis-report/analysis-report-view.js";
import { AnalysisModeNav } from "../analyze/analysis-mode-nav.js";
import {
  QuickAnalysisApiError,
  quickAnalysisClient,
  type QuickAnalysisClient,
  type QuickManifestAnalysisInput,
} from "./quick-analysis-api.js";
import { QuickAnalysisForm } from "./quick-analysis-form.js";

export interface QuickAnalysisPageProps {
  readonly client?: QuickAnalysisClient;
}

function errorMessage(error: unknown): string | undefined {
  if (error instanceof QuickAnalysisApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return "StackLens could not analyze this manifest right now.";
  }

  return undefined;
}

const capabilitySteps = [
  {
    number: "01",
    title: "Validate",
    detail: "Parse the manifest through the same authoritative server rules used by the API.",
  },
  {
    number: "02",
    title: "Inventory",
    detail: "Build deterministic dependency evidence without installing or executing the project.",
  },
  {
    number: "03",
    title: "Explain limits",
    detail: "Mark source, configuration, and external metadata gaps instead of guessing.",
  },
] as const;

export function QuickAnalysisPage({
  client = quickAnalysisClient,
}: Readonly<QuickAnalysisPageProps>) {
  const [report, setReport] = useState<AnalysisReport>();
  const mutation = useMutation({
    mutationFn: (input: QuickManifestAnalysisInput) => client.analyzeManifest(input),
    onSuccess: (nextReport) => {
      setReport(nextReport);
    },
  });

  async function handleSubmit(input: QuickManifestAnalysisInput): Promise<void> {
    await mutation.mutateAsync(input);
  }

  function startAnother(): void {
    setReport(undefined);
    mutation.reset();
    window.scrollTo({ top: 0 });
  }

  if (report !== undefined) {
    return (
      <main className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-linear-to-b from-primary/8 via-primary/3 to-transparent"
        />
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card/90 p-4">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                Quick analysis complete
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Manifest-only evidence is intentionally narrower than repository analysis.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={startAnother}>
              Analyze another manifest
            </Button>
          </div>

          <AnalysisReportView report={report} completedWithLimitations />
        </div>
      </main>
    );
  }

  const mutationError = errorMessage(mutation.error);

  return (
    <main className="relative isolate min-h-[calc(100dvh-73px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-linear-to-b from-primary/10 via-primary/3 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-28 right-[8%] -z-10 size-48 rounded-full border border-primary/10 bg-primary/5 blur-3xl"
      />

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:items-start lg:gap-14 lg:py-20">
        <section className="grid gap-8 lg:sticky lg:top-8">
          <div className="grid gap-5">
            <div className="flex">
              <span className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
                Quick package analysis
              </span>
            </div>
            <div className="grid gap-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
                Inspect a package.json without handing over a repository.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                Get a fast dependency-focused first pass from pasted or local manifest content.
                StackLens stays explicit about what manifest-only evidence cannot prove.
              </p>
            </div>
          </div>

          <div className="grid gap-0 overflow-hidden rounded-2xl border bg-card/70">
            {capabilitySteps.map((step, index) => (
              <article
                key={step.number}
                className={[
                  "grid grid-cols-[3rem_minmax(0,1fr)] gap-4 p-5",
                  index === 0 ? "" : "border-t",
                ].join(" ")}
              >
                <span className="font-mono text-sm font-semibold text-primary">{step.number}</span>
                <div className="grid gap-1">
                  <h2 className="text-sm font-semibold">{step.title}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">{step.detail}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border bg-background/70 p-3">
              <strong className="block text-sm">Local read</strong>
              <span className="text-xs text-muted-foreground">for file input</span>
            </div>
            <div className="rounded-xl border bg-background/70 p-3">
              <strong className="block text-sm">No account</strong>
              <span className="text-xs text-muted-foreground">required</span>
            </div>
            <div className="rounded-xl border bg-background/70 p-3">
              <strong className="block text-sm">No execution</strong>
              <span className="text-xs text-muted-foreground">of project code</span>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card/95 text-card-foreground shadow-sm backdrop-blur">
          <div className="border-b bg-muted/20 p-4 sm:p-5">
            <AnalysisModeNav current="manifest" />
          </div>
          <div className="grid gap-6 p-5 sm:p-7">
            <div className="grid gap-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Start quick analysis
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">Provide package.json</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Paste JSON or choose a local file. The browser submits the existing K2 JSON
                contract; no multipart upload or repository access is added.
              </p>
            </div>

            <QuickAnalysisForm
              onSubmit={handleSubmit}
              isPending={mutation.isPending}
              onInputChange={() => mutation.reset()}
              {...(mutationError === undefined ? {} : { serverError: mutationError })}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
