import { describe, expect, it } from "vitest";

import { runAnalyzer } from "@stacklens/analyzer-core";
import type {
  AnalysisScorer,
  AnalyzerDefinition,
  FindingPrioritizer,
} from "@stacklens/analyzer-core";
import { AnalysisReportSchema } from "@stacklens/contracts";
import type {
  AnalysisLimitation,
  AnalysisScores,
  DataSource,
  ExternalEvidence,
} from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "../src/analysis-metadata.js";
import {
  createDependencyInventoryEvidence,
  dependencyInventoryRule,
} from "../src/dependency-inventory.js";
import { deprecatedDependencyRule } from "../src/deprecated-dependency.js";
import { npmRegistryHealthFactRule } from "../src/npm-registry-health.js";
import { outdatedDependencyRule } from "../src/outdated-dependency.js";
import { normalizePackageManifest } from "../src/manifest.js";
import type { NormalizedPackageManifest } from "../src/manifest.js";

const scoreLimitation: AnalysisLimitation = {
  id: "limitation-npm-metadata-score",
  kind: "insufficient_evidence",
  message: "npm metadata findings do not yet define production StackLens health scores.",
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

const testPrioritizer: FindingPrioritizer<NormalizedPackageManifest, JavaScriptAnalysisMetadata> = {
  kind: "priority",
  id: "TEST-PRIORITY-NPM-METADATA",
  version: "1",
  requirementIds: ["FR-016"],
  prioritize(_context, finding) {
    return {
      level: "low",
      rule: {
        id: "TEST-PRIORITY-NPM-METADATA",
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
  version: "test-score-npm-metadata",
  score() {
    return createInsufficientEvidenceScores();
  },
};

const analyzer: AnalyzerDefinition<NormalizedPackageManifest, JavaScriptAnalysisMetadata> = {
  version: "test-analyzer-npm-metadata",
  ruleSet: {
    version: "rules-javascript-npm-metadata",
    factRules: [dependencyInventoryRule, npmRegistryHealthFactRule],
    findingRules: [outdatedDependencyRule, deprecatedDependencyRule],
    prioritizer: testPrioritizer,
    recommendationRules: [],
  },
  scorer,
};

describe("npm metadata analyzer integration [FR-006, FR-007, FR-010]", () => {
  it("produces contract-valid health facts plus outdated and deprecated factual findings", () => {
    const project = normalizePackageManifest({
      dependencies: {
        "example-package": "1.0.0",
      },
    });
    const projectEvidence = createDependencyInventoryEvidence(project);
    const source: DataSource = {
      id: "source-npm-example",
      provider: "npm-registry",
      status: "available",
      retrievedAt: "2026-09-19T09:30:00Z",
      reference: "https://registry.npmjs.org/example-package",
    };
    const externalEvidence: ExternalEvidence = {
      id: "evidence-npm-example",
      kind: "external",
      sourceId: source.id,
      summary: "npm Registry package metadata for example-package",
      reference: source.reference!,
      url: source.reference!,
    };

    const report = runAnalyzer(analyzer, {
      analysisId: "analysis-npm-metadata",
      createdAt: "2026-09-19T09:30:00Z",
      input: {
        type: "manifest",
        fingerprint: "sha256:npm-metadata-fixture",
      },
      project,
      metadata: {
        npmRegistry: [
          {
            sourceId: source.id,
            snapshot: {
              packageName: "example-package",
              registryModifiedAt: "2026-09-18T12:00:00Z",
              distTags: [
                {
                  tag: "latest",
                  version: "2.0.0",
                },
              ],
              versions: [
                {
                  version: "1.0.0",
                  deprecatedMessage: "Use 2.x instead.",
                  publishedAt: "2025-01-01T00:00:00Z",
                },
                {
                  version: "2.0.0",
                  publishedAt: "2026-09-18T12:00:00Z",
                },
              ],
            },
          },
        ],
      },
      sources: [source],
      evidence: [...projectEvidence, externalEvidence],
      limitations: [scoreLimitation],
    });

    expect(report.facts).toHaveLength(2);
    expect(report.facts.map((fact) => fact.type).toSorted()).toEqual([
      "dependency.health.npm_registry",
      "dependency.inventory",
    ]);
    expect(report.findings).toHaveLength(2);
    expect(report.findings.map((finding) => finding.rule.id).toSorted()).toEqual([
      "JS-NPM-006",
      "JS-NPM-007",
    ]);
    expect(report.findings.every((finding) => finding.classification === "fact")).toBe(true);
    expect(report.findings.every((finding) => finding.priority.level === "low")).toBe(true);
    expect(report.recommendations).toEqual([]);
    expect(report.scores.overall.status).toBe("insufficient_evidence");
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });

  it("keeps range declarations limited rather than manufacturing provider-backed findings", () => {
    const project = normalizePackageManifest({
      dependencies: {
        "example-package": "^1.0.0",
      },
    });
    const projectEvidence = createDependencyInventoryEvidence(project);
    const source: DataSource = {
      id: "source-npm-example-range",
      provider: "npm-registry",
      status: "available",
      retrievedAt: "2026-09-19T09:31:00Z",
      reference: "https://registry.npmjs.org/example-package",
    };
    const externalEvidence: ExternalEvidence = {
      id: "evidence-npm-example-range",
      kind: "external",
      sourceId: source.id,
      summary: "npm Registry package metadata for example-package",
      reference: source.reference!,
      url: source.reference!,
    };

    const report = runAnalyzer(analyzer, {
      analysisId: "analysis-npm-metadata-range",
      createdAt: "2026-09-19T09:31:00Z",
      input: {
        type: "manifest",
        fingerprint: "sha256:npm-metadata-range-fixture",
      },
      project,
      metadata: {
        npmRegistry: [
          {
            sourceId: source.id,
            snapshot: {
              packageName: "example-package",
              distTags: [
                {
                  tag: "latest",
                  version: "2.0.0",
                },
              ],
              versions: [
                {
                  version: "1.0.0",
                },
                {
                  version: "2.0.0",
                },
              ],
            },
          },
        ],
      },
      sources: [source],
      evidence: [...projectEvidence, externalEvidence],
      limitations: [scoreLimitation],
    });

    expect(report.facts.map((fact) => fact.type)).toContain("dependency.health.npm_registry");
    expect(report.findings).toEqual([]);
    expect(
      report.limitations.filter((limitation) =>
        ["JS-NPM-006", "JS-NPM-007"].some((ruleId) => limitation.ruleIds.includes(ruleId)),
      ),
    ).toHaveLength(2);
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });
});
