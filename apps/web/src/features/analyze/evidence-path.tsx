const steps = [
  { title: "Evidence", detail: "Manifest, lockfiles, source" },
  { title: "Findings", detail: "Facts and labeled heuristics" },
  { title: "Next steps", detail: "Recommendations with reasons" },
] as const;

export function EvidencePath() {
  return (
    <aside
      aria-labelledby="evidence-path-title"
      className="evidence-path bg-brand-surface px-5 py-6 text-brand-foreground sm:px-7"
    >
      <p id="evidence-path-title" className="analysis-eyebrow text-brand-muted">
        From input to action
      </p>
      <ol className="mt-5 grid">
        {steps.map((step) => (
          <li key={step.title} className="evidence-path-row grid gap-1 py-3 first:pt-0">
            <strong className="text-sm">{step.title}</strong>
            <span className="text-sm text-brand-muted">{step.detail}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
