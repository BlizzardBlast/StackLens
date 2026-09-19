import { describe, expect, it } from "vitest";

import { runAnalyzer } from "@stacklens/analyzer-core";
import type {
  AnalysisScorer,
  AnalyzerDefinition,
  FindingPrioritizer,
} from "@stacklens/analyzer-core";
import { AnalysisReportSchema } from "@stacklens/contracts";
import type { AnalysisLimitation, AnalysisScores } from "@stacklens/contracts";

import {
  createDependencyInventoryEvidence,
  dependencyInventoryRule,
} from "../src/dependency-inventory.js";
import { dependencyOverlapRule } from "../src/dependency-overlap.js";
import { frameworkToolDetectionRule } from "../src/framework-tool-detection.js";
import { normalizePackageManifest } from "../src/manifest.js";
import {
  createProjectConfigurationEvidence,
  projectConfigurationRule,
} from "../src/project-configuration.js";
import {
  createJavaScriptProjectSnapshot,
  type JavaScriptProjectSnapshot,
} from "../src/project-snapshot.js";

const scoreLimitation: AnalysisLimitation = {
  id: "limitation-project-detection-score",
  kind: "insufficient_evidence",
  message: "Project detection findings do not yet define production StackLens health scores.",
  affectedCategories: ["dependencies", "security", "maintainability", "testing", "tooling"],
  sourceIds: [],
  ruleIds: [],
};

function createInsufficientEvidenceScores(): AnalysisScores {
  const score = {
    status: "insufficient_evidence" as const,
    evidenceCoverage: 0,
    limitationIds: [scoreLimitation.id],
  };

  return {
    overall: score,
    categories: {
      dependencies: score,
      security: score,
      maintainability: score,
      testing: score,
      tooling: score,
    },
    contributions: [],
  };
}

const testPrioritizer: FindingPrioritizer<JavaScriptProjectSnapshot, unknown> = {
  kind: "priority",
  id: "TEST-PRIORITY-PROJECT-DETECTION",
  version: "1",
  requirementIds: ["FR-016"],
  prioritize(_context, finding) {
    return {
      level: "low",
      rule: {
        id: "TEST-PRIORITY-PROJECT-DETECTION",
        version: "1",
      },
      rationale: "Test-only priority verifies analyzer integration without production policy.",
      factors: [
        {
          key: "test-only",
          rationale: "This factor exists only to produce a contract-valid integration fixture.",
          evidenceIds: [finding.evidenceIds[0]!],
        },
      ],
    };
  },
};

const scorer: AnalysisScorer = {
  version: "test-score-project-detection",
  score() {
    return createInsufficientEvidenceScores();
  },
};

const analyzer: AnalyzerDefinition<JavaScriptProjectSnapshot, unknown> = {
  version: "test-analyzer-project-detection",
  ruleSet: {
    version: "rules-javascript-project-detection",
    factRules: [
      dependencyInventoryRule,
      frameworkToolDetectionRule,
      projectConfigurationRule,
    ],
    findingRules: [dependencyOverlapRule],
    prioritizer: testPrioritizer,
    recommendationRules: [],
  },
  scorer,
};

describe("project detection analyzer integration [FR-008, FR-012, FR-013]", () => {
  it("produces contract-valid static tool/config facts and an overlap heuristic without production scoring", () => {
    const manifest = normalizePackageManifest({
      devDependencies: {
        jest: "30.0.0",
        vite: "7.1.0",
        vitest: "5.0.1",
      },
    });
    const project = createJavaScriptProjectSnapshot(manifest, [
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            strict: true,
            target: "ES2022",
          },
        }),
      },
      {
        path: "vite.config.ts",
        content: "export default { build: { target: 'es2022' } };",
      },
    ]);
    const evidence = [
      ...createDependencyInventoryEvidence(project),
      ...createProjectConfigurationEvidence(project),
    ];

    const report = runAnalyzer(analyzer, {
      analysisId: "analysis-project-detection",
      createdAt: "2026-09-19T10:30:00Z",
      input: {
        type: "repository",
        fingerprint: "github:fixture:aaaaaaaa",
        repository: {
          provider: "github",
          owner: "stacklens-fixture",
          name: "fixture-repository",
          commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          ref: "main",
        },
      },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [scoreLimitation],
    });

    expect(report.facts.filter((fact) => fact.type === "dependency.inventory")).toHaveLength(3);
    expect(report.facts.filter((fact) => fact.type.startsWith("project.tool."))).toHaveLength(3);
    expect(report.facts.filter((fact) => fact.type.startsWith("project.configuration."))).toHaveLength(
      2,
    );
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      classification: "heuristic",
      category: "dependencies",
      rule: {
        id: "JS-OVERLAP-008",
        version: "1",
      },
      confidence: {
        level: "medium",
      },
      priority: {
        level: "low",
        rule: {
          id: "TEST-PRIORITY-PROJECT-DETECTION",
          version: "1",
        },
      },
    });
    expect(report.limitations).toEqual(
      expect.arrayContaining([
        scoreLimitation,
        expect.objectContaining({
          kind: "unsupported_configuration",
          ruleIds: ["JS-CONFIG-013"],
          message: expect.stringContaining("did not import, execute, or resolve dynamic values"),
        }),
      ]),
    );
    expect(report.recommendations).toEqual([]);
    expect(report.scores.overall.status).toBe("insufficient_evidence");
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });
});
