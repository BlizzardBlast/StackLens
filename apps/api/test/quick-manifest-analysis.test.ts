import { describe, expect, it } from "vitest";

import type {
  AnalysisScorer,
  AnalyzerDefinition,
  FindingPrioritizer,
} from "@stacklens/analyzer-core";
import { AnalysisReportSchema } from "@stacklens/contracts";
import type { AnalysisScores } from "@stacklens/contracts";
import {
  dependencyInventoryRule,
  type NormalizedPackageManifest,
} from "@stacklens/rules-javascript";

import {
  analyzeQuickManifest,
  createManifestFingerprint,
  QUICK_MANIFEST_INPUT_LIMITATION_ID,
  QUICK_MANIFEST_METADATA_LIMITATION_ID,
} from "../src/index.js";

function createInsufficientEvidenceScores(limitationIds: readonly string[]): AnalysisScores {
  const score = {
    status: "insufficient_evidence" as const,
    evidenceCoverage: 0,
    limitationIds: [...limitationIds],
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

function createTestAnalyzer(
  onScore?: () => void,
): AnalyzerDefinition<NormalizedPackageManifest, unknown> {
  const prioritizer: FindingPrioritizer<NormalizedPackageManifest, unknown> = {
    kind: "priority",
    id: "TEST-PRIORITY-QUICK-MANIFEST",
    version: "1",
    requirementIds: ["FR-016"],
    prioritize() {
      throw new Error("Quick manifest inventory must not create finding candidates");
    },
  };

  const scorer: AnalysisScorer = {
    version: "test-score-quick-manifest",
    score(context) {
      onScore?.();
      return createInsufficientEvidenceScores(context.limitations.map((item) => item.id));
    },
  };

  return {
    version: "test-analyzer-quick-manifest",
    ruleSet: {
      version: "rules-javascript-quick-manifest",
      factRules: [dependencyInventoryRule],
      findingRules: [],
      prioritizer,
      recommendationRules: [],
    },
    scorer,
  };
}

const baseCommand = {
  analysisId: "analysis-quick-manifest",
  createdAt: "2026-09-19T05:00:00Z",
} as const;

describe("analyzeQuickManifest [FR-001, FR-002, FR-004, FR-022, SEC-003]", () => {
  it("accepts pasted package.json and returns the dependency inventory report", () => {
    const content = JSON.stringify({
      name: "fixture-app",
      dependencies: {
        react: "^19.0.0",
      },
      scripts: {
        postinstall: "never-retain-this-script",
      },
    });

    const result = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "paste",
          content,
        },
      },
      {
        analyzer: createTestAnalyzer(),
      },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected quick manifest analysis to succeed");
    }

    expect(result.report.input).toEqual({
      type: "manifest",
      fingerprint: createManifestFingerprint(content),
    });
    expect(result.report.facts).toHaveLength(1);
    expect(result.report.facts[0]?.subject.name).toBe("react");
    expect(result.report.limitations.map((item) => item.id)).toEqual([
      QUICK_MANIFEST_INPUT_LIMITATION_ID,
      QUICK_MANIFEST_METADATA_LIMITATION_ID,
    ]);
    expect(result.report.scores.overall.status).toBe("insufficient_evidence");
    expect(JSON.stringify(result.report)).not.toContain("never-retain-this-script");
    expect(AnalysisReportSchema.safeParse(result.report).success).toBe(true);
  });

  it("returns a stable validation error for invalid pasted JSON without invoking analysis", () => {
    let scoreCalls = 0;

    const result = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "paste",
          content: '{"dependencies":',
        },
      },
      {
        analyzer: createTestAnalyzer(() => {
          scoreCalls += 1;
        }),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_json",
        message: "package.json must contain valid JSON.",
        requirementIds: ["FR-001", "FR-004"],
      },
    });
    expect(scoreCalls).toBe(0);
  });

  it("accepts an uploaded package.json through the same authoritative service boundary", () => {
    const content = '{"devDependencies":{"vitest":"^5.0.1"}}';

    const result = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "upload",
          filename: "package.json",
          content,
        },
      },
      {
        analyzer: createTestAnalyzer(),
      },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected uploaded package.json analysis to succeed");
    }

    expect(result.report.facts[0]?.details).toEqual({
      kind: "dependency_inventory",
      dependencyGroup: "devDependencies",
      declaredSpecifier: "^5.0.1",
    });
  });

  it("rejects unsupported uploaded files with an actionable error", () => {
    const result = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "upload",
          filename: "manifest.txt",
          content: "{}",
        },
      },
      {
        analyzer: createTestAnalyzer(),
      },
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: "unsupported_upload",
        message: "Uploaded quick-analysis files must be named package.json.",
        requirementIds: ["FR-002", "FR-004"],
      },
    });
  });

  it("surfaces manifest-shape validation without coercing invalid dependency values", () => {
    const result = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "paste",
          content: '{"dependencies":{"react":19}}',
        },
      },
      {
        analyzer: createTestAnalyzer(),
      },
    );

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected malformed manifest analysis to fail");
    }

    expect(result.error.code).toBe("invalid_manifest");
    expect(result.error.message).toContain(
      "dependencies.react must be a non-empty string dependency specifier",
    );
  });

  it("fingerprints equivalent paste and upload content identically without retaining source text", () => {
    const content = '{\n  "dependencies": { "react": "^19.0.0" }\n}';
    const analyzer = createTestAnalyzer();

    const pasted = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "paste",
          content,
        },
      },
      { analyzer },
    );
    const uploaded = analyzeQuickManifest(
      {
        ...baseCommand,
        input: {
          kind: "upload",
          filename: "package.json",
          content,
        },
      },
      { analyzer },
    );

    expect(pasted.ok).toBe(true);
    expect(uploaded.ok).toBe(true);

    if (!pasted.ok || !uploaded.ok) {
      throw new Error("Expected both quick manifest inputs to succeed");
    }

    expect(pasted.report.input.fingerprint).toBe(uploaded.report.input.fingerprint);
    expect(pasted.report.facts).toEqual(uploaded.report.facts);
  });
});
