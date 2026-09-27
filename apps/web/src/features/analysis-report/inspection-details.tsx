import type { AnalysisReport, ScoreResultV2 } from "@stacklens/contracts";

const stateLabels = {
  pass: "Passed",
  fail: "Failed",
  unknown: "Unknown",
  not_applicable: "Not applicable",
} as const;
const linkClass =
  "rounded-sm text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring";
export function FactLinks({ ids }: Readonly<{ ids: readonly string[] }>) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {ids.map((id, index) => (
        <a className={linkClass} key={id} href={`#fact-${id}`}>
          Supporting fact {index + 1}
        </a>
      ))}
    </span>
  );
}
export function InspectionChecks({
  score,
  report,
}: Readonly<{ score: ScoreResultV2; report: AnalysisReport }>) {
  const facts = report.facts.filter((fact) => score.checkFactIds.includes(fact.id));
  return (
    <>
      <p className="text-xs leading-5 text-muted-foreground">{score.scope}</p>
      {score.status === "available" && score.band !== undefined ? (
        <p className="text-sm font-semibold">Risk band: {score.band}</p>
      ) : null}
      {score.status === "available" && score.affectedPackageCount !== undefined ? (
        <p className="text-xs text-muted-foreground">
          {score.affectedPackageCount} affected package names
          {score.affectedAdvisoryCount === undefined
            ? ""
            : ` · ${score.affectedAdvisoryCount} distinct advisories`}
        </p>
      ) : null}
      <p className="text-xs leading-5">{score.rationale}</p>
      <details className="text-sm">
        <summary className="cursor-pointer rounded-md py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
          Inspection checks ({facts.length})
        </summary>
        <p className="my-2 text-xs text-muted-foreground">
          {score.checkCounts.passed} passed · {score.checkCounts.failed} failed ·{" "}
          {score.checkCounts.unknown} unknown · {score.checkCounts.notApplicable} not applicable
        </p>
        <ul className="grid gap-3">
          {facts.map((fact) =>
            fact.details?.kind !== "inspection_check" ? null : (
              <li key={fact.id} className="rounded-lg border p-3">
                <p className="font-semibold">
                  {stateLabels[fact.details.state]} · {fact.details.packageName ?? fact.details.key}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {fact.details.packagePath}
                </p>
                <p className="my-2 text-xs leading-5">{fact.statement}</p>
                <FactLinks ids={[fact.id]} />
              </li>
            ),
          )}
        </ul>
      </details>
    </>
  );
}

export function SupportingEvidence({ report }: Readonly<{ report: AnalysisReport }>) {
  return (
    <section aria-labelledby="supporting-evidence-title" className="grid gap-3">
      <h2 id="supporting-evidence-title" className="text-xl font-semibold tracking-tight">
        Inspection facts and evidence
      </h2>
      <p className="text-sm text-muted-foreground">
        Score explanations link to the inspected facts below. Source and configuration bodies are
        not stored in this report.
      </p>
      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer rounded-md py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring">
          Supporting facts ({report.facts.length})
        </summary>
        <ul className="mt-3 grid gap-3">
          {report.facts.map((fact) => (
            <li
              id={`fact-${fact.id}`}
              tabIndex={-1}
              key={fact.id}
              className="scroll-mt-6 rounded-lg border p-3 outline-none focus:ring-3 focus:ring-ring"
            >
              <p className="font-semibold">{fact.subject.name}</p>
              <p className="mt-1 text-sm">{fact.statement}</p>
              {fact.details?.kind === "configuration_inspection" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Inspected: {fact.details.provenancePaths.join(", ")}. Unresolved fields:{" "}
                  {fact.details.unresolvedFields.join(", ") || "none"}. Configured plugins:{" "}
                  {fact.details.configuredPlugins.join(", ") || "none identified"}.
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {fact.evidenceIds.map((id, index) => (
                  <a className={linkClass} key={id} href={`#evidence-${id}`}>
                    Evidence {index + 1}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </details>
      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer rounded-md py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring">
          Evidence records ({report.evidence.length})
        </summary>
        <ul className="mt-3 grid gap-3">
          {report.evidence.map((evidence) => (
            <li
              id={`evidence-${evidence.id}`}
              tabIndex={-1}
              key={evidence.id}
              className="scroll-mt-6 rounded-lg border p-3 text-sm outline-none focus:ring-3 focus:ring-ring"
            >
              <p>{evidence.summary}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {evidence.kind === "project" ? evidence.location?.path : evidence.reference}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
