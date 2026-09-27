import { describe, expect, it } from "vitest";

import { runAnalyzer } from "@stacklens/analyzer-core";
import { AnalysisReportSchema } from "@stacklens/contracts";
import type { DataSource, ExternalEvidence } from "@stacklens/contracts";
import { stackHealthScorer } from "@stacklens/scoring";

import {
  createDependencyInventoryEvidence,
  createJavaScriptProjectSnapshot,
  createSourceUsageEvidence,
  dependencyInventoryRule,
  evidenceBackedRecommendationRule,
  javascriptFindingPrioritizer,
  knownVulnerabilityRule,
  migrationOpportunityRule,
  normalizePackageManifest,
  outdatedDependencyRule,
  scoringCoverageFactRule,
  projectReadinessFactRule,
  sourceUsageFactRule,
  withJavaScriptSourceUsage,
} from "../src/index.js";
import type { JavaScriptAnalysisMetadata } from "../src/index.js";

const observedAt = "2026-09-20T00:30:00Z";

function npmSource(id: string, packageName: string): DataSource {
  return {
    id,
    provider: "npm-registry",
    status: "available",
    retrievedAt: observedAt,
    reference: `https://registry.npmjs.org/${packageName}`,
  };
}

function npmEvidence(id: string, sourceId: string, packageName: string): ExternalEvidence {
  return {
    id,
    kind: "external",
    sourceId,
    summary: `npm Registry package metadata for ${packageName}`,
    reference: `https://registry.npmjs.org/${packageName}`,
    url: `https://registry.npmjs.org/${packageName}`,
  };
}

describe("production analysis policy integration [FR-014–FR-021, SCORE-001–SCORE-004]", () => {
  it("flows a deterministic major migration through priority, recommendation, and explainable scores", () => {
    const manifest = normalizePackageManifest({
      dependencies: {
        "legacy-package": "1.0.0",
        react: "18.2.0",
      },
    });
    const project = withJavaScriptSourceUsage(
      createJavaScriptProjectSnapshot(manifest, [
        {
          path: "src/index.ts",
          content:
            'import legacy from "legacy-package"; import React from "react"; export const value = [legacy, React.version];',
        },
      ]),
      "complete",
    );
    const legacySource = npmSource("source-npm-legacy", "legacy-package");
    const reactSource = npmSource("source-npm-react", "react");
    const osvSource: DataSource = {
      id: "source-osv-policy",
      provider: "osv",
      status: "available",
      retrievedAt: observedAt,
      reference: "https://api.osv.dev/v1/querybatch",
    };
    const evidence = [
      ...createDependencyInventoryEvidence(project),
      ...createSourceUsageEvidence(project),
      npmEvidence("evidence-npm-legacy", legacySource.id, "legacy-package"),
      npmEvidence("evidence-npm-react", reactSource.id, "react"),
      {
        id: "evidence-osv-query-legacy",
        kind: "external" as const,
        sourceId: osvSource.id,
        summary: "OSV exact-version query for legacy-package@1.0.0 completed with 0 matches.",
        reference: "npm:legacy-package@1.0.0",
        url: "https://api.osv.dev/v1/querybatch",
      },
      {
        id: "evidence-osv-query-react",
        kind: "external" as const,
        sourceId: osvSource.id,
        summary: "OSV exact-version query for react@18.2.0 completed with 0 matches.",
        reference: "npm:react@18.2.0",
        url: "https://api.osv.dev/v1/querybatch",
      },
    ];
    const metadata: JavaScriptAnalysisMetadata = {
      npmRegistry: [
        {
          sourceId: legacySource.id,
          snapshot: {
            packageName: "legacy-package",
            distTags: [{ tag: "latest", version: "2.0.0" }],
            versions: [{ version: "1.0.0" }, { version: "2.0.0" }],
          },
        },
        {
          sourceId: reactSource.id,
          snapshot: {
            packageName: "react",
            distTags: [{ tag: "latest", version: "18.2.0" }],
            versions: [{ version: "18.2.0" }],
          },
        },
      ],
      osv: {
        sourceId: osvSource.id,
        snapshot: {
          queryResults: [
            {
              packageName: "legacy-package",
              version: "1.0.0",
              matches: [],
              complete: true,
            },
            {
              packageName: "react",
              version: "18.2.0",
              matches: [],
              complete: true,
            },
          ],
          vulnerabilities: [],
        },
      },
    };
    const report = runAnalyzer(
      {
        version: "javascript-policy-v1",
        ruleSet: {
          version: "javascript-policy-rules-v1",
          factRules: [
            dependencyInventoryRule,
            scoringCoverageFactRule,
            sourceUsageFactRule,
            projectReadinessFactRule,
          ],
          findingRules: [knownVulnerabilityRule, migrationOpportunityRule, outdatedDependencyRule],
          prioritizer: javascriptFindingPrioritizer,
          recommendationRules: [evidenceBackedRecommendationRule],
        },
        scorer: stackHealthScorer,
      },
      {
        analysisId: "analysis-policy-integration",
        createdAt: observedAt,
        input: {
          type: "repository",
          fingerprint: "github:fixture:policy",
          repository: {
            provider: "github",
            owner: "stacklens-fixture",
            name: "policy",
            commitSha: "d".repeat(40),
            ref: "main",
          },
        },
        project,
        metadata,
        sources: [legacySource, reactSource, osvSource],
        evidence,
      },
    );

    const migration = report.findings.find((finding) => finding.rule.id === "JS-MIGRATION-014");
    expect(migration).toMatchObject({
      category: "maintainability",
      classification: "heuristic",
      subject: {
        name: "legacy-package",
      },
      priority: {
        level: "medium",
        rule: {
          id: "JS-PRIORITY-016",
          version: "1",
        },
      },
    });
    expect(migration?.title).toContain("1.0.0");
    expect(migration?.title).toContain("2.0.0");
    expect(
      report.findings.some(
        (finding) => finding.rule.id === "JS-MIGRATION-014" && finding.subject.name === "react",
      ),
    ).toBe(false);

    expect(report.recommendations).toHaveLength(1);
    expect(report.recommendations[0]?.basis).toBe("heuristic");
    expect(report.recommendations[0]?.findingIds).toContain(migration?.id ?? "");
    expect(report.recommendations[0]?.suggestion).toContain("major-version migration");

    expect(report.scores.categories.dependencies).toEqual({
      status: "available",
      evidenceCoverage: 100,
      value: 88,
      contributionIds: [expect.any(String)],
    });
    expect(report.scores.categories.security).toEqual({
      status: "available",
      evidenceCoverage: 100,
      value: 100,
      contributionIds: [],
    });
    expect(report.scores.categories.maintainability).toMatchObject({
      status: "available",
      evidenceCoverage: 100,
      value: 88,
    });
    expect(report.scores.overall).toEqual({
      status: "insufficient_evidence",
      evidenceCoverage: 60,
      limitationIds: expect.any(Array),
    });
    expect(report.scores.contributions).toHaveLength(2);
    expect(
      report.scores.contributions.find((item) => item.category === "dependencies"),
    ).toMatchObject({
      category: "dependencies",
      direction: "deduction",
      points: 12,
      findingIds: [expect.any(String)],
      rule: {
        id: "SCORE-STACK-001",
        version: "2",
      },
    });
    expect(report.analyzer.scoringVersion).toBe("stack-health-v2");
    expect(JSON.stringify(report).toLowerCase()).not.toContain('"secure"');
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });
});
