import type { AnalysisReport } from "@stacklens/contracts";

export function createRepositoryReportFixture(): AnalysisReport {
  const insufficientScore = {
    status: "insufficient_evidence" as const,
    evidenceCoverage: 20,
    limitationIds: ["limitation-coverage"],
  };

  return {
    schemaVersion: "1.0.0",
    analysisId: "analysis-web-001",
    createdAt: "2026-09-21T12:00:00Z",
    input: {
      type: "repository",
      fingerprint: "sha256:web-fixture",
      repository: {
        provider: "github",
        owner: "BlizzardBlast",
        name: "StackLens",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
        ref: "main",
      },
    },
    analyzer: {
      version: "0.1.0",
      ruleSetVersion: "0.1.0",
      scoringVersion: "stack-health-v1",
    },
    sources: [],
    evidence: [
      {
        id: "evidence-manifest",
        kind: "project",
        summary: "example-package is declared in package.json.",
        location: {
          path: "package.json",
          startLine: 10,
        },
      },
    ],
    facts: [],
    findings: [
      {
        id: "finding-example",
        classification: "fact",
        category: "dependencies",
        subject: {
          type: "dependency",
          name: "example-package",
        },
        title: "Example evidence-backed finding",
        description: "The fixture preserves analyzer-owned classification and priority.",
        rule: {
          id: "JS-EXAMPLE-001",
          version: "1",
        },
        requirementIds: ["FR-017"],
        evidenceIds: ["evidence-manifest"],
        factIds: [],
        limitationIds: [],
        priority: {
          level: "medium",
          rule: {
            id: "JS-PRIORITY-016",
            version: "1",
          },
          rationale: "The analyzer assigned medium priority.",
          factors: [
            {
              key: "fixture-factor",
              rationale: "Fixture priority factor.",
              evidenceIds: ["evidence-manifest"],
            },
          ],
        },
      },
    ],
    recommendations: [],
    scores: {
      overall: { ...insufficientScore },
      categories: {
        dependencies: { ...insufficientScore },
        security: { ...insufficientScore },
        maintainability: { ...insufficientScore },
        testing: { ...insufficientScore },
        tooling: { ...insufficientScore },
      },
      contributions: [],
    },
    limitations: [
      {
        id: "limitation-coverage",
        kind: "insufficient_evidence",
        message: "The bounded fixture intentionally has incomplete evidence coverage.",
        affectedCategories: ["dependencies", "security", "maintainability", "testing", "tooling"],
        sourceIds: [],
        ruleIds: [],
      },
    ],
    partialFailures: [],
  };
}
