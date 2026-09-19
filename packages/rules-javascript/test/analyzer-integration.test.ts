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
import { normalizePackageManifest } from "../src/manifest.js";
import type { NormalizedPackageManifest } from "../src/manifest.js";

const scoreLimitation: AnalysisLimitation = {
  id: "limitation-fr-005-score",
  kind: "insufficient_evidence",
  message: "Dependency inventory alone is not sufficient to claim StackLens health scores.",
  affectedCategories: [
    "dependencies",
    "security",
    "maintainability",
    "testing",
    "tooling",
  ],
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

const inertPrioritizer: FindingPrioritizer<NormalizedPackageManifest, unknown> = {
  kind: "priority",
  id: "TEST-PRIORITY-FR-005",
  version: "1",
  requirementIds: ["FR-016"],
  prioritize() {
    throw new Error("FR-005 integration must not create finding candidates");
  },
};

const scorer: AnalysisScorer = {
  version: "test-score-fr-005",
  score() {
    return createInsufficientEvidenceScores();
  },
};

const analyzer: AnalyzerDefinition<NormalizedPackageManifest, unknown> = {
  version: "test-analyzer-fr-005",
  ruleSet: {
    version: "rules-javascript-fr-005",
    factRules: [dependencyInventoryRule],
    findingRules: [],
    prioritizer: inertPrioritizer,
    recommendationRules: [],
  },
  scorer,
};

describe("FR-005 analyzer integration", () => {
  it("produces a contract-valid report without inventing findings or scores", () => {
    const project = normalizePackageManifest({
      dependencies: {
        react: "^19.0.0",
      },
      devDependencies: {
        vitest: "^5.0.1",
      },
    });
    const evidence = createDependencyInventoryEvidence(project);

    const report = runAnalyzer(analyzer, {
      analysisId: "analysis-fr-005",
      createdAt: "2026-09-19T04:30:00Z",
      input: {
        type: "manifest",
        fingerprint: "sha256:fr-005-fixture",
      },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [scoreLimitation],
    });

    expect(report.facts).toHaveLength(2);
    expect(report.findings).toEqual([]);
    expect(report.recommendations).toEqual([]);
    expect(report.scores.overall.status).toBe("insufficient_evidence");
    expect(report.facts[0]?.details?.kind).toBe("dependency_inventory");
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });
});
