import type { AnalysisReport } from "../src/analysis-report.js";

export function createValidAnalysisReport(): AnalysisReport {
  return {
    schemaVersion: "1.0.0",
    analysisId: "analysis-001",
    createdAt: "2026-09-19T02:00:00Z",
    input: {
      type: "repository",
      fingerprint: "sha256:example",
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
      scoringVersion: "0.1.0",
    },
    sources: [
      {
        id: "source-npm",
        provider: "npm",
        status: "available",
        retrievedAt: "2026-09-19T02:00:00Z",
        reference: "legacy-tool",
      },
    ],
    evidence: [
      {
        id: "evidence-manifest",
        kind: "project",
        summary: "legacy-tool is declared in dependencies.",
        location: {
          path: "package.json",
          startLine: 10,
          endLine: 10,
        },
      },
      {
        id: "evidence-npm",
        kind: "external",
        summary: "npm marks legacy-tool as deprecated.",
        sourceId: "source-npm",
        reference: "legacy-tool",
        url: "https://www.npmjs.com/package/legacy-tool",
      },
    ],
    facts: [
      {
        id: "fact-dependency-declared",
        type: "dependency.declared",
        subject: {
          type: "dependency",
          name: "legacy-tool",
        },
        statement: "legacy-tool is declared by the analyzed project.",
        rule: {
          id: "JS-DEP-001",
          version: "1",
        },
        requirementIds: ["FR-005", "DATA-003"],
        evidenceIds: ["evidence-manifest"],
      },
      {
        id: "fact-dependency-deprecated",
        type: "dependency.deprecated",
        subject: {
          type: "dependency",
          name: "legacy-tool",
        },
        statement: "The package is explicitly deprecated by its registry metadata.",
        rule: {
          id: "JS-DEP-007",
          version: "1",
        },
        requirementIds: ["FR-007", "DATA-001", "DATA-003"],
        evidenceIds: ["evidence-npm"],
      },
    ],
    findings: [
      {
        id: "finding-deprecated-package",
        classification: "fact",
        category: "dependencies",
        subject: {
          type: "dependency",
          name: "legacy-tool",
        },
        title: "A declared dependency is deprecated",
        description: "The package registry explicitly marks legacy-tool as deprecated.",
        rule: {
          id: "JS-DEP-007",
          version: "1",
        },
        requirementIds: ["FR-007", "FR-017", "DATA-003"],
        evidenceIds: ["evidence-npm"],
        factIds: ["fact-dependency-deprecated"],
        limitationIds: [],
        priority: {
          level: "high",
          rule: {
            id: "PRIORITY-001",
            version: "1",
          },
          rationale: "Explicit deprecation can create upgrade and maintenance risk.",
          factors: [
            {
              key: "explicit-deprecation",
              rationale: "The package registry explicitly declares the package deprecated.",
              evidenceIds: ["evidence-npm"],
            },
          ],
        },
      },
    ],
    recommendations: [
      {
        id: "recommendation-replace-deprecated-package",
        basis: "fact",
        title: "Evaluate a supported replacement",
        suggestion: "Plan removal or replacement of legacy-tool.",
        why: "The package is explicitly deprecated.",
        impact: "Reducing reliance on deprecated packages lowers maintenance risk.",
        rule: {
          id: "JS-REC-007",
          version: "1",
        },
        requirementIds: ["FR-015", "DATA-005"],
        findingIds: ["finding-deprecated-package"],
        evidenceIds: ["evidence-npm"],
      },
    ],
    scores: {
      overall: {
        status: "available",
        value: 90,
        evidenceCoverage: 80,
        contributionIds: ["score-contribution-deprecation"],
      },
      categories: {
        dependencies: {
          status: "available",
          value: 90,
          evidenceCoverage: 100,
          contributionIds: ["score-contribution-deprecation"],
        },
        security: {
          status: "insufficient_evidence",
          evidenceCoverage: 0,
          limitationIds: ["limitation-security"],
        },
        maintainability: {
          status: "available",
          value: 100,
          evidenceCoverage: 100,
          contributionIds: [],
        },
        testing: {
          status: "insufficient_evidence",
          evidenceCoverage: 0,
          limitationIds: ["limitation-testing"],
        },
        tooling: {
          status: "available",
          value: 100,
          evidenceCoverage: 100,
          contributionIds: [],
        },
      },
      contributions: [
        {
          id: "score-contribution-deprecation",
          category: "dependencies",
          direction: "deduction",
          points: 10,
          rationale: "Explicit package deprecation affects dependency health.",
          rule: {
            id: "SCORE-DEP-001",
            version: "1",
          },
          findingIds: ["finding-deprecated-package"],
          factIds: ["fact-dependency-deprecated"],
          evidenceIds: ["evidence-npm"],
        },
      ],
    },
    limitations: [
      {
        id: "limitation-security",
        kind: "insufficient_evidence",
        message: "This fixture does not provide supported vulnerability evidence.",
        affectedCategories: ["security"],
        sourceIds: [],
        ruleIds: [],
      },
      {
        id: "limitation-testing",
        kind: "insufficient_evidence",
        message: "This fixture does not provide supported testing evidence.",
        affectedCategories: ["testing"],
        sourceIds: [],
        ruleIds: [],
      },
    ],
    partialFailures: [],
  };
}
