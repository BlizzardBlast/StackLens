const steps = [
  { title: "Evidence", detail: "Manifest, lockfiles, source" },
  { title: "Findings", detail: "Facts and labeled heuristics" },
  { title: "Next steps", detail: "Recommendations with reasons" },
] as const;

export function EvidencePath() {
  return (
    <section
      aria-label="From repository to report"
      className="rounded-2xl bg-brand-surface px-5 py-6 text-brand-foreground sm:px-7"
    >
      <p className="mb-5 text-sm text-brand-muted">A clear path from evidence to action</p>
      <ol className="grid gap-0">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[1.5rem_1fr] gap-4 pb-5 last:pb-0"
          >
            {index === steps.length - 1 ? null : (
              <span
                aria-hidden="true"
                className="absolute top-5 bottom-0 left-3 border-l border-brand-border"
              />
            )}
            <span
              aria-hidden="true"
              className="relative mt-1 flex size-6 items-center justify-center rounded-md border border-brand-border bg-brand-surface"
            >
              <span className="size-1.5 rounded-full bg-brand-accent" />
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="font-medium">{step.title}</h2>
              <p className="text-sm text-brand-muted">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
