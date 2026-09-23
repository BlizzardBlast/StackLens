import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AnalysisFact,
  AnalysisReport,
  Evidence,
  Finding,
  ScoreCategory,
  ScoreResult,
} from "@stacklens/contracts";
import { Button } from "@stacklens/ui/components/button";
import { AnalysisLimitation } from "@stacklens/ui/domain/analysis-limitation";
import { EvidenceCoverage } from "@stacklens/ui/domain/evidence-coverage";
import { FindingCard } from "@stacklens/ui/domain/finding-card";

const categoryLabels: Record<ScoreCategory, string> = {
  dependencies: "Dependencies",
  security: "Security",
  maintainability: "Maintainability",
  testing: "Testing",
  tooling: "Tooling",
};

const categories = [
  "dependencies",
  "security",
  "maintainability",
  "testing",
  "tooling",
] as const satisfies readonly ScoreCategory[];

interface ScoreCardProps {
  readonly label: string;
  readonly score: ScoreResult;
}

function ScoreCard({ label, score }: Readonly<ScoreCardProps>) {
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4" aria-label={label}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">{label}</h3>
        <strong className="text-xl">
          {score.status === "available" ? `${score.value}/100` : "N/A"}
        </strong>
      </div>
      <EvidenceCoverage percent={score.evidenceCoverage} />
      {score.status === "insufficient_evidence" ? (
        <p className="text-xs text-muted-foreground">Insufficient evidence for a numeric score.</p>
      ) : null}
    </section>
  );
}

type DependencyInventoryFact = AnalysisFact & {
  readonly details: NonNullable<AnalysisFact["details"]>;
};

const dependencyGroupLabels: Readonly<Record<string, string>> = {
  dependencies: "Runtime dependencies",
  devDependencies: "Development dependencies",
  peerDependencies: "Peer dependencies",
  optionalDependencies: "Optional dependencies",
};

const dependencyGroupOrder = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

function isDependencyInventoryFact(fact: AnalysisFact): fact is DependencyInventoryFact {
  return fact.type === "dependency.inventory" && fact.details?.kind === "dependency_inventory";
}

function ManifestInsights({ report }: Readonly<{ report: AnalysisReport }>) {
  const dependencyFacts = report.facts.filter(isDependencyInventoryFact);
  const toolFacts = report.facts.filter((fact) => fact.type.startsWith("project.tool."));
  const groups = dependencyGroupOrder
    .map((group) => ({
      group,
      facts: dependencyFacts.filter((fact) => fact.details.dependencyGroup === group),
    }))
    .filter(({ facts }) => facts.length > 0);

  return (
    <section className="grid gap-4" aria-labelledby="manifest-insights-title">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">
          Manifest insights
        </p>
        <h2 id="manifest-insights-title" className="mt-1 text-xl font-semibold tracking-tight">
          Verified from package.json
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          These are deterministic analyzer facts from the submitted manifest. They remain useful
          even when repository-only evidence is unavailable for a numeric health score.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border bg-card p-4">
          <strong className="text-2xl tabular-nums">{dependencyFacts.length}</strong>
          <p className="mt-1 text-sm font-medium">Declared dependency entries</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dependency groups remain distinct when the same package is declared more than once.
          </p>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <strong className="text-2xl tabular-nums">{toolFacts.length}</strong>
          <p className="mt-1 text-sm font-medium">Supported frameworks and tools detected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Detection uses exact supported package identities rather than package-name guessing.
          </p>
        </article>
      </div>

      {toolFacts.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          No supported framework or tool signatures were detected in the declared dependencies.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {toolFacts.map((fact) => (
            <article key={fact.id} className="rounded-xl border bg-card p-4">
              <h3 className="font-semibold">{fact.subject.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{fact.statement}</p>
            </article>
          ))}
        </div>
      )}

      {dependencyFacts.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          No supported dependency declarations were present in the submitted manifest.
        </p>
      ) : (
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/35">
            View declared dependencies ({dependencyFacts.length})
          </summary>
          <div className="grid gap-5 border-t p-4">
            {groups.map(({ group, facts }) => (
              <section key={group} className="grid gap-2" aria-label={dependencyGroupLabels[group]}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">{dependencyGroupLabels[group]}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">{facts.length}</span>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {facts.map((fact) => (
                    <li
                      key={fact.id}
                      className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                    >
                      <span className="truncate text-sm font-medium">{fact.subject.name}</span>
                      <code className="shrink-0 text-xs text-muted-foreground">
                        {fact.details.declaredSpecifier}
                      </code>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

interface EvidenceDetailProps {
  readonly finding: Finding;
  readonly evidence: readonly Evidence[];
  readonly report: AnalysisReport;
  readonly onClose: () => void;
}

function EvidenceDetail({ finding, evidence, report, onClose }: Readonly<EvidenceDetailProps>) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const sourcesById = useMemo(
    () => new Map(report.sources.map((source) => [source.id, source])),
    [report.sources],
  );

  return (
    <aside
      className="evidence-disclosure grid gap-4 rounded-xl border border-primary/40 bg-card p-5"
      aria-labelledby="evidence-detail-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Evidence
          </p>
          <h3
            ref={headingRef}
            tabIndex={-1}
            id="evidence-detail-title"
            className="mt-1 text-lg font-semibold outline-none"
          >
            {finding.title}
          </h3>
        </div>
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="grid gap-3">
        {evidence.map((item) => {
          if (item.kind === "project") {
            return (
              <article key={item.id} className="rounded-lg border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Project evidence
                </p>
                <p className="mt-2 text-sm">{item.summary}</p>
                {item.location === undefined ? null : (
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {item.location.path}
                    {item.location.startLine === undefined ? "" : `:${item.location.startLine}`}
                  </p>
                )}
              </article>
            );
          }

          const source = sourcesById.get(item.sourceId);

          return (
            <article key={item.id} className="rounded-lg border p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                External evidence
              </p>
              <p className="mt-2 text-sm">{item.summary}</p>
              <dl className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <div>
                  <dt className="inline font-semibold text-foreground">Source: </dt>
                  <dd className="inline">{source?.provider ?? item.sourceId}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-foreground">Reference: </dt>
                  <dd className="inline">{item.reference}</dd>
                </div>
              </dl>
              {item.url === undefined ? null : (
                <a
                  className="mt-3 inline-flex min-h-10 items-center rounded-md text-sm font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/35"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open source reference
                </a>
              )}
            </article>
          );
        })}
      </div>

      <div className="border-t pt-4 text-sm">
        <p>
          <span className="font-semibold">Rule:</span>{" "}
          <code>
            {finding.rule.id} · v{finding.rule.version}
          </code>
        </p>
        <p className="mt-2 text-muted-foreground">{finding.priority.rationale}</p>
      </div>
    </aside>
  );
}

export interface AnalysisReportViewProps {
  readonly report: AnalysisReport;
  readonly completedWithLimitations?: boolean;
}

export function AnalysisReportView({
  report,
  completedWithLimitations = false,
}: Readonly<AnalysisReportViewProps>) {
  const [selectedFindingId, setSelectedFindingId] = useState<string>();

  const selectedFinding = report.findings.find((finding) => finding.id === selectedFindingId);
  const selectedEvidence =
    selectedFinding === undefined
      ? []
      : report.evidence.filter((evidence) => selectedFinding.evidenceIds.includes(evidence.id));
  const hasLimitations =
    completedWithLimitations || report.limitations.length > 0 || report.partialFailures.length > 0;

  const isManifestAnalysis = report.input.type === "manifest";
  const repository =
    report.input.type === "repository"
      ? `${report.input.repository.owner}/${report.input.repository.name}`
      : "package.json · quick analysis";

  return (
    <article className="grid min-w-0 gap-8 wrap-anywhere">
      <header className="grid gap-3 border-b pb-6">
        <p className="font-mono text-sm text-muted-foreground">{repository}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Analysis report</h1>
            {report.input.type === "repository" ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {report.input.repository.ref ?? "resolved revision"} @{" "}
                {report.input.repository.commitSha.slice(0, 12)}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Report schema {report.schemaVersion} · Scoring {report.analyzer.scoringVersion}
          </p>
        </div>
      </header>

      {isManifestAnalysis ? (
        <section
          className="grid gap-2 rounded-xl border border-primary/20 bg-primary/5 p-5"
          aria-labelledby="manifest-boundary-title"
        >
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Evidence boundary
          </p>
          <h2 id="manifest-boundary-title" className="text-lg font-semibold">
            Manifest-only analysis
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            This report can inspect supported package.json evidence, but it has no repository
            source, configuration, or external provider snapshot. N/A means insufficient
            evidence—not a clean bill of health.
          </p>
        </section>
      ) : null}

      {hasLimitations ? (
        <AnalysisLimitation title="Analysis completed with limitations">
          Some evidence was unavailable or incomplete. Review the limitations before interpreting
          scores or findings.
        </AnalysisLimitation>
      ) : null}

      {isManifestAnalysis ? <ManifestInsights report={report} /> : null}

      <section className="grid gap-4" aria-labelledby="score-summary-title">
        <div className="grid gap-3 rounded-xl border bg-muted/50 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="score-summary-title" className="text-lg font-semibold">
              Stack health
            </h2>
            <strong className="text-3xl">
              {report.scores.overall.status === "available"
                ? `${report.scores.overall.value}/100`
                : "N/A"}
            </strong>
          </div>
          <EvidenceCoverage percent={report.scores.overall.evidenceCoverage} />
          {isManifestAnalysis ? (
            <p className="text-sm text-muted-foreground">
              For quick analysis, this percentage measures evidence available to the numeric scoring
              policy—not how much of package.json StackLens parsed. The manifest insights above
              remain analyzer-backed observations.
            </p>
          ) : null}
          {report.scores.overall.status === "insufficient_evidence" ? (
            <p className="text-sm text-muted-foreground">
              Overall score is unavailable because the report has insufficient supported evidence.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <ScoreCard
              key={category}
              label={categoryLabels[category]}
              score={report.scores.categories[category]}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="findings-title">
        <div>
          <h2 id="findings-title" className="text-xl font-semibold tracking-tight">
            Findings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence-backed facts and heuristics from the analyzer report.
          </p>
        </div>

        {report.findings.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            No supported findings were emitted for this analysis.
          </p>
        ) : (
          <div className="grid gap-4">
            {report.findings.map((finding) => (
              <FindingCard
                key={finding.id}
                classification={finding.classification}
                priority={finding.priority.level}
                {...(finding.classification === "heuristic"
                  ? { confidence: finding.confidence.level }
                  : {})}
                subject={finding.subject.name}
                title={finding.title}
                description={finding.description}
                category={finding.category}
                ruleId={finding.rule.id}
                onViewEvidence={() => {
                  setSelectedFindingId(finding.id);
                }}
              />
            ))}
          </div>
        )}

        {selectedFinding === undefined ? null : (
          <EvidenceDetail
            key={selectedFinding.id}
            finding={selectedFinding}
            evidence={selectedEvidence}
            report={report}
            onClose={() => {
              setSelectedFindingId(undefined);
            }}
          />
        )}
      </section>

      {report.recommendations.length === 0 ? null : (
        <section className="grid gap-4" aria-labelledby="recommendations-title">
          <div>
            <h2 id="recommendations-title" className="text-xl font-semibold tracking-tight">
              Recommendations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Suggested actions remain separate from observed findings.
            </p>
          </div>
          <div className="grid gap-4">
            {report.recommendations.map((recommendation) => (
              <article key={recommendation.id} className="grid gap-3 rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{recommendation.title}</h3>
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    {recommendation.basis}
                  </span>
                </div>
                <p className="text-sm">{recommendation.suggestion}</p>
                <p className="text-sm text-muted-foreground">{recommendation.why}</p>
                <footer className="border-t pt-3 font-mono text-xs text-muted-foreground">
                  {recommendation.rule.id} · v{recommendation.rule.version}
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {report.limitations.length === 0 && report.partialFailures.length === 0 ? null : (
        <section className="grid gap-3" aria-labelledby="limitations-title">
          <h2 id="limitations-title" className="text-xl font-semibold tracking-tight">
            Limitations
          </h2>
          {report.limitations.map((limitation) => (
            <AnalysisLimitation key={limitation.id} title="Evidence limitation">
              {limitation.message}
            </AnalysisLimitation>
          ))}
          {report.partialFailures.map((failure) => (
            <AnalysisLimitation key={failure.id} title="Partial analysis issue">
              {failure.message}
            </AnalysisLimitation>
          ))}
        </section>
      )}
    </article>
  );
}
