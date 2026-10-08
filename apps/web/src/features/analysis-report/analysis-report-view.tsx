import { useEffect, useMemo, useRef, useState, type Ref } from "react";

import type {
  AnalysisFact,
  AnalysisReport,
  Evidence,
  Finding,
  ScoreCategory,
  ScoreResult,
  ScoreResultV2,
} from "@stacklens/contracts";
import { Button } from "@stacklens/ui/components/button";
import { AnalysisLimitation } from "@stacklens/ui/domain/analysis-limitation";
import { FindingCard } from "@stacklens/ui/domain/finding-card";

import { FactLinks, InspectionChecks, SupportingEvidence } from "./inspection-details";
import { groupLimitations } from "./report-limitations";
import type { LimitationGroup } from "./report-limitations";

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
  readonly score: ScoreResult | ScoreResultV2;
  readonly category: ScoreCategory;
  readonly report: AnalysisReport;
  readonly limitationGroups: readonly LimitationGroup[];
}

const scoreScopes: Record<ScoreCategory, string> = {
  dependencies: "Version health: outdated, deprecated, and overlapping dependencies.",
  security: "Known advisories for supported exact dependency versions.",
  maintainability: "Major-version migration readiness; general code quality is outside this scope.",
  testing: "Static test-command and test-file setup. Tests were not run.",
  tooling: "Package-manager pin and committed lockfile reproducibility.",
};

function ScoreCard({ label, score, category, report, limitationGroups }: Readonly<ScoreCardProps>) {
  const unimplemented =
    report.analyzer.scoringVersion === "stack-health-v1" &&
    (category === "maintainability" || category === "testing" || category === "tooling") &&
    score.status === "insufficient_evidence";
  const blockers =
    score.status === "insufficient_evidence"
      ? limitationGroups.filter((group) =>
          group.limitations.some((limitation) => score.limitationIds.includes(limitation.id)),
        )
      : [];
  const contributions =
    score.status === "available"
      ? report.scores.contributions.filter((item) => score.contributionIds.includes(item.id))
      : [];
  return (
    <section
      id={`score-${category}`}
      className="grid min-w-0 gap-3 self-start rounded-xl border bg-card p-4"
      aria-label={label}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">{label}</h3>
        <strong className="text-xl">
          {score.status === "available"
            ? `${Number(score.value.toFixed(1))}/100`
            : score.status === "not_applicable"
              ? "—"
              : "N/A"}
        </strong>
      </div>
      {report.analyzer.scoringVersion === "stack-health-v2" ? (
        <p className="text-xs leading-5 text-muted-foreground">{scoreScopes[category]}</p>
      ) : null}
      {"checkFactIds" in score ? <InspectionChecks score={score} report={report} /> : null}
      <p className="text-sm font-medium">
        {unimplemented
          ? "Scoring not implemented in this report’s version"
          : score.status === "available"
            ? "Supported scoring checks complete"
            : score.status === "not_applicable"
              ? "Not applicable to this scope"
              : "Analysis incomplete for this score"}
      </p>
      {unimplemented ? (
        <p className="text-xs text-muted-foreground">
          Run a new analysis to use the current scoring policy. This historical score is preserved.
        </p>
      ) : null}
      {blockers.length === 0 ? null : (
        <details className="text-sm">
          <summary className="cursor-pointer rounded-md py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
            Why N/A? ({blockers.length} {blockers.length === 1 ? "reason" : "reasons"})
          </summary>
          <ul className="mt-2 grid gap-3">
            {blockers.map((group) => (
              <li key={group.anchor}>
                <a
                  className="text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
                  href={`#${group.anchor}`}
                >
                  {group.message}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {score.status === "available" ? (
        <details className="text-sm">
          <summary className="cursor-pointer rounded-md py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
            Score explanation ({contributions.length}{" "}
            {"checkFactIds" in score ? "decisions" : "deductions"})
          </summary>
          {report.analyzer.scoringVersion === "stack-health-v2" && score.value === 0 ? (
            <p className="mt-2 text-muted-foreground">
              Deductions reached the score floor of zero. This is a scored result with evidence;
              missing evidence is shown as N/A.
            </p>
          ) : null}
          {contributions.length === 0 ? (
            <p className="mt-2 text-muted-foreground">
              No score-impacting findings were reported within this scope.
            </p>
          ) : (
            <ul className="mt-2 grid gap-3">
              {contributions.map((contribution) => (
                <li key={contribution.id}>
                  {"kind" in contribution ? null : <strong>−{contribution.points} points. </strong>}
                  {contribution.rationale}
                  {"kind" in contribution ? <FactLinks ids={contribution.factIds} /> : null}
                </li>
              ))}
            </ul>
          )}
        </details>
      ) : null}
    </section>
  );
}

type DependencyInventoryFact = AnalysisFact & {
  readonly details: Extract<NonNullable<AnalysisFact["details"]>, { kind: "dependency_inventory" }>;
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
            className="mt-1 rounded-sm text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring"
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
  readonly reportHeadingRef?: Ref<HTMLHeadingElement>;
}

export function AnalysisReportView({
  report,
  completedWithLimitations = false,
  reportHeadingRef,
}: Readonly<AnalysisReportViewProps>) {
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [packagePath, setPackagePath] = useState<string>();
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const findingsHeadingRef = useRef<HTMLHeadingElement>(null);
  const packages = report.facts.flatMap((fact) =>
    fact.details?.kind === "workspace_package" ? [fact.details.package] : [],
  );
  const selectedPackage = packages.some((item) => item.path === packagePath)
    ? packagePath
    : undefined;
  const findings: readonly Finding[] = report.findings;
  const visibleFindings = findings.filter(
    (finding) =>
      selectedPackage === undefined ||
      ("packagePath" in finding && finding.packagePath === selectedPackage),
  );
  const visibleFindingIds = new Set(visibleFindings.map((finding) => finding.id));
  const visibleRecommendations = report.recommendations.filter((item) =>
    item.findingIds.some((id) => visibleFindingIds.has(id)),
  );
  const findingGroups =
    report.schemaVersion === "2.0.0"
      ? [
          {
            title: "Confirmed issues",
            items: visibleFindings.filter((item) => item.disposition === "issue"),
          },
          {
            title: "Update opportunities",
            items: visibleFindings.filter((item) => item.disposition === "opportunity"),
          },
          {
            title: "Review advice",
            items: visibleFindings.filter(
              (item) => item.disposition === "advice" || item.disposition === undefined,
            ),
          },
        ]
      : [{ title: "Findings", items: visibleFindings }];

  const selectedFinding = report.findings.find((finding) => finding.id === selectedFindingId);
  const selectedEvidence =
    selectedFinding === undefined
      ? []
      : report.evidence.filter((evidence) => selectedFinding.evidenceIds.includes(evidence.id));
  const hasLimitations =
    completedWithLimitations || report.limitations.length > 0 || report.partialFailures.length > 0;

  const isManifestAnalysis = report.input.type === "manifest";
  const limitationGroups = groupLimitations(report.limitations);
  const availableCategoryCount = categories.filter(
    (category) => report.scores.categories[category].status === "available",
  ).length;
  const acquisition = report.facts.find((fact) => fact.type === "project.repository.coverage");
  const repository =
    report.input.type === "repository"
      ? `${report.input.repository.owner}/${report.input.repository.name}`
      : "package.json · quick analysis";

  return (
    <article className="report-layout grid min-w-0 gap-8 wrap-anywhere">
      <header className="grid gap-3 border-b pb-6">
        <p className="font-mono text-sm text-muted-foreground">{repository}</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              ref={reportHeadingRef}
              tabIndex={-1}
              className="rounded-sm text-3xl font-medium tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring sm:text-4xl"
            >
              Analysis report
            </h1>
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
          className="report-boundary grid gap-2 rounded-xl border border-primary/20 bg-primary/5 p-5"
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
          {limitationGroups.length} distinct evidence{" "}
          {limitationGroups.length === 1 ? "limitation" : "limitations"}
          {report.partialFailures.length > 0
            ? ` and ${report.partialFailures.length} acquisition or rule ${report.partialFailures.length === 1 ? "issue" : "issues"}`
            : ""}
          .{" "}
          <a
            className="font-semibold underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
            href="#limitations-title"
          >
            Review causes and affected checks
          </a>
          .
        </AnalysisLimitation>
      ) : null}

      {isManifestAnalysis ? <ManifestInsights report={report} /> : null}

      <section className="grid gap-4" aria-labelledby="score-summary-title">
        <div className="report-score-summary grid gap-3 rounded-xl border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="score-summary-title" className="text-lg font-semibold">
              Stack health
            </h2>
            <strong className="text-3xl">
              {report.scores.overall.status === "available"
                ? `${Number(report.scores.overall.value.toFixed(1))}/100`
                : report.scores.overall.status === "not_applicable"
                  ? "Not applicable"
                  : "N/A"}
            </strong>
          </div>
          <p className="text-sm font-medium">
            {availableCategoryCount} of {categories.length} category scores available
          </p>
          {"rationale" in report.scores.overall ? (
            <p className="text-sm leading-6">{report.scores.overall.rationale}</p>
          ) : null}
          {acquisition === undefined ? null : (
            <p className="text-sm text-muted-foreground">{acquisition.statement}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Score availability describes the supported scoring checks. It does not measure the
            percentage of repository evidence inspected.
          </p>
          {report.scores.overall.status === "insufficient_evidence" ? (
            <p className="text-sm text-muted-foreground">
              {report.analyzer.scoringVersion === "stack-health-v2"
                ? "Overall score requires all five category scores."
                : "Overall score is unavailable under this report’s scoring policy."}{" "}
              Review the N/A explanations below.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <ScoreCard
              key={category}
              label={categoryLabels[category]}
              score={report.scores.categories[category]}
              category={category}
              report={report}
              limitationGroups={limitationGroups}
            />
          ))}
        </div>
      </section>

      {report.limitations.length === 0 && report.partialFailures.length === 0 ? null : (
        <section className="grid gap-3" aria-labelledby="limitations-title">
          <h2
            id="limitations-title"
            className="report-section-heading text-xl font-semibold tracking-tight"
          >
            Limitations and next steps
          </h2>
          <p className="text-sm text-muted-foreground">
            Repeated messages are grouped. Complete checks and evidence-backed findings remain
            useful.
          </p>
          {limitationGroups.map((group) => {
            const affected = [
              ...new Set(group.limitations.flatMap((limitation) => limitation.affectedCategories)),
            ];
            const rules = [
              ...new Set(group.limitations.flatMap((limitation) => limitation.ruleIds)),
            ];
            const blockedScores = categories.filter((category) => {
              const score = report.scores.categories[category];
              return (
                score.status === "insufficient_evidence" &&
                group.limitations.some((limitation) => score.limitationIds.includes(limitation.id))
              );
            });
            return (
              <div
                key={group.anchor}
                id={group.anchor}
                tabIndex={-1}
                className="scroll-mt-6 rounded-xl outline-none focus:ring-3 focus:ring-ring"
              >
                <AnalysisLimitation
                  title={
                    group.kind === "resource_limit"
                      ? "Repository collection limit"
                      : group.kind === "unsupported_configuration"
                        ? "Static configuration support"
                        : "Evidence limitation"
                  }
                >
                  {[...new Set(group.limitations.map((item) => item.message))].map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                  {group.limitations.some((item) => item.packagePaths !== undefined) ? (
                    <p className="mt-2 font-mono text-xs">
                      Packages:{" "}
                      {[
                        ...new Set(group.limitations.flatMap((item) => item.packagePaths ?? [])),
                      ].join(", ")}
                    </p>
                  ) : null}
                  {group.limitations.some((item) => item.paths !== undefined) ? (
                    <p className="mt-1 font-mono text-xs">
                      Files:{" "}
                      {[...new Set(group.limitations.flatMap((item) => item.paths ?? []))].join(
                        ", ",
                      )}
                    </p>
                  ) : null}
                  {group.limitations.some((item) => item.checkKeys !== undefined) ? (
                    <p className="mt-1 text-xs">
                      Affected checks:{" "}
                      {[...new Set(group.limitations.flatMap((item) => item.checkKeys ?? []))].join(
                        ", ",
                      )}
                    </p>
                  ) : null}
                  {affected.length === 0 ? null : (
                    <p className="mt-2 text-xs">
                      Related analysis areas:{" "}
                      {affected.map((category) => categoryLabels[category]).join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-xs">
                    {blockedScores.length > 0
                      ? `Blocks scoring: ${blockedScores.map((category) => categoryLabels[category]).join(", ")}.`
                      : "This limitation does not block the completed scoring checks."}
                  </p>
                  {blockedScores.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      {blockedScores.map((category) => (
                        <a
                          className="rounded-sm font-semibold underline outline-none focus-visible:ring-3 focus-visible:ring-ring"
                          href={`#score-${category}`}
                          key={category}
                        >
                          {categoryLabels[category]} score
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {group.limitations.length > 1 ? (
                    <p className="mt-1 text-xs">
                      Grouped from {group.limitations.length} rule notices.
                    </p>
                  ) : null}
                  {rules.length === 0 ? null : (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer rounded-md py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring">
                        Rule references
                      </summary>
                      <p className="mt-1 font-mono">{rules.join(", ")}</p>
                    </details>
                  )}
                </AnalysisLimitation>
              </div>
            );
          })}
          {report.partialFailures.map((failure) => (
            <AnalysisLimitation key={failure.id} title="Partial analysis issue">
              <p>{failure.message}</p>
              <p className="mt-2 text-xs">
                {failure.retryable
                  ? "This issue may be transient. Retry the analysis after the source recovers."
                  : "A provider or supported-format change may be required before rerunning the analysis."}
              </p>
            </AnalysisLimitation>
          ))}
        </section>
      )}

      <section className="grid gap-4" aria-labelledby="findings-title">
        <div>
          <h2
            ref={findingsHeadingRef}
            tabIndex={-1}
            id="findings-title"
            className="report-section-heading rounded-sm text-xl font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Findings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Evidence-backed facts and heuristics from the analyzer report.
          </p>
        </div>

        {packages.length > 1 ? (
          <fieldset className="min-w-0 rounded-xl border p-4">
            <legend className="px-2 text-sm font-semibold">
              Filter findings and recommendations by package
            </legend>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={selectedPackage === undefined ? "default" : "outline"}
                aria-pressed={selectedPackage === undefined}
                onClick={() => {
                  setPackagePath(undefined);
                  setSelectedFindingId(undefined);
                }}
              >
                All packages
              </Button>
              {packages.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  className="h-auto max-w-full min-w-0 whitespace-normal"
                  variant={selectedPackage === item.path ? "default" : "outline"}
                  aria-pressed={selectedPackage === item.path}
                  onClick={() => {
                    setPackagePath(item.path);
                    setSelectedFindingId(undefined);
                  }}
                >
                  {item.name ?? "Root"} · {item.path}
                </Button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {visibleFindings.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            No supported findings were emitted for this selection.
          </p>
        ) : (
          <div className="grid gap-4">
            {findingGroups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <section key={group.title} className="grid gap-4" aria-label={group.title}>
                  {report.schemaVersion === "2.0.0" ? (
                    <h3 className="text-lg font-semibold">
                      {group.title} ({group.items.length})
                    </h3>
                  ) : null}
                  {group.items.map((finding) => (
                    <div
                      key={finding.id}
                      id={`finding-${finding.id}`}
                      className="grid min-w-0 gap-2"
                    >
                      {"details" in finding && finding.details?.kind === "advisory" ? (
                        <p className="text-sm font-semibold">
                          Advisory severity: {finding.details.severity} ·{" "}
                          {finding.details.advisoryId}
                          {finding.details.aliases.length > 0
                            ? ` · Aliases: ${finding.details.aliases.join(", ")}`
                            : ""}
                        </p>
                      ) : null}
                      <FindingCard
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
                        onViewEvidence={(event) => {
                          evidenceTriggerRef.current = event.currentTarget;
                          setSelectedFindingId(finding.id);
                        }}
                      />
                    </div>
                  ))}
                </section>
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
              const trigger = evidenceTriggerRef.current;
              (trigger?.isConnected ? trigger : findingsHeadingRef.current)?.focus();
              evidenceTriggerRef.current = null;
            }}
          />
        )}
      </section>

      {visibleRecommendations.length === 0 ? null : (
        <section className="grid gap-4" aria-labelledby="recommendations-title">
          <div>
            <h2
              id="recommendations-title"
              className="report-section-heading text-xl font-semibold tracking-tight"
            >
              Recommendations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Suggested actions remain separate from observed findings.
            </p>
          </div>
          <div className="grid gap-4">
            {visibleRecommendations.map((recommendation) => (
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
      {report.schemaVersion === "2.0.0" ? <SupportingEvidence report={report} /> : null}
    </article>
  );
}
