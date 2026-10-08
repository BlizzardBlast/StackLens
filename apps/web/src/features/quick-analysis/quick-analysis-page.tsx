import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { AnalysisReport } from "@stacklens/contracts";
import { Button } from "@stacklens/ui/components/button";

import { AnalysisReportView } from "../analysis-report/analysis-report-view.js";
import { AnalysisInputPanel } from "../analyze/analysis-input-panel.js";
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
  if (error instanceof QuickAnalysisApiError) return error.message;
  if (error instanceof Error) return "StackLens could not analyze this manifest right now.";
  return undefined;
}

const capabilitySteps = [
  {
    title: "Provide your manifest",
    detail: "Paste package.json or choose the file from your device.",
  },
  {
    title: "Explore your dependencies",
    detail: "See declared packages and supported tools, without running project code.",
  },
  {
    title: "Understand the boundaries",
    detail: "Source, configuration, and external metadata gaps stay explicit.",
  },
] as const;

export function QuickAnalysisPage({
  client = quickAnalysisClient,
}: Readonly<QuickAnalysisPageProps>) {
  const [report, setReport] = useState<AnalysisReport>();
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);
  const introductionHeadingRef = useRef<HTMLHeadingElement>(null);
  const resetFocusRequested = useRef(false);
  useEffect(() => {
    if (report !== undefined) {
      reportHeadingRef.current?.focus();
    } else if (resetFocusRequested.current) {
      resetFocusRequested.current = false;
      introductionHeadingRef.current?.focus();
    }
  }, [report]);
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
    resetFocusRequested.current = true;
    setReport(undefined);
    mutation.reset();
    window.scrollTo({ top: 0 });
  }

  const mutationError = errorMessage(mutation.error);
  return (
    <>
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {report === undefined ? "" : "Quick analysis complete. Report ready."}
      </output>
      {report !== undefined ? (
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
            <div>
              <p className="text-sm font-semibold">Quick analysis complete</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on the package.json you provided.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={startAnother}>
              Analyze another manifest
            </Button>
          </div>
          <AnalysisReportView
            report={report}
            completedWithLimitations
            reportHeadingRef={reportHeadingRef}
          />
        </div>
      ) : (
        <div className="analysis-workspace mx-auto grid w-full max-w-6xl items-start gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-x-14 lg:py-16">
          <section className="analysis-intro">
            <p className="analysis-eyebrow">A focused first pass</p>
            <h1
              ref={introductionHeadingRef}
              tabIndex={-1}
              className="analysis-title rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              Start with your package.json.
            </h1>
            <p className="max-w-lg text-lg leading-7 text-muted-foreground">
              Get a clearer picture of your dependencies from a single file. No repository access or
              account required.
            </p>
          </section>

          <AnalysisInputPanel
            current="manifest"
            formTitle="Provide package.json"
            formDescription="Paste the contents or choose a local file. Its text is sent to StackLens when you run the analysis."
            className="lg:col-start-2 lg:row-span-2"
          >
            <QuickAnalysisForm
              onSubmit={handleSubmit}
              isPending={mutation.isPending}
              onInputChange={() => mutation.reset()}
              {...(mutationError === undefined ? {} : { serverError: mutationError })}
            />
          </AnalysisInputPanel>

          <div className="grid gap-8 lg:col-start-1 lg:row-start-2">
            <section aria-label="Quick analysis steps">
              <ol className="grid gap-6">
                {capabilitySteps.map((step, index) => (
                  <li key={step.title} className="grid grid-cols-[1.75rem_1fr] gap-3">
                    <span
                      aria-hidden="true"
                      className="quick-step-marker flex size-7 items-center justify-center rounded-full border"
                    >
                      {index + 1}
                    </span>
                    <div className="grid gap-1">
                      <h2 className="font-semibold">{step.title}</h2>
                      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <aside className="quick-boundary grid gap-2 bg-brand-surface p-5 text-brand-foreground sm:p-7">
              <h2 className="text-lg font-medium">One file. A useful starting point.</h2>
              <p className="text-sm leading-6 text-brand-muted">
                A manifest tells part of the story. For supported source, lockfile, and provider
                evidence, choose GitHub repository analysis.
              </p>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
