import { useEffect, useMemo, useRef, useState } from "react";

import type {
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
  }, [finding.id]);

  const sourcesById = useMemo(
    () => new Map(report.sources.map((source) => [source.id, source])),
    [report.sources],
  );

  return (
    <aside
      className="grid gap-4 rounded-xl border bg-card p-5"
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

  const repository =
    report.input.type === "repository"
      ? `${report.input.repository.owner}/${report.input.repository.name}`
      : "Manifest analysis";

  return (
    <article className="grid gap-8">
      <header className="grid gap-3">
        <p className="font-mono text-sm text-muted-foreground">{repository}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analysis report</h1>
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

      {hasLimitations ? (
        <AnalysisLimitation title="Analysis completed with limitations">
          Some evidence was unavailable or incomplete. Review the limitations before interpreting
          scores or findings.
        </AnalysisLimitation>
      ) : null}

      <section className="grid gap-4" aria-labelledby="score-summary-title">
        <div className="grid gap-3 rounded-xl border bg-card p-5">
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
