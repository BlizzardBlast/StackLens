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
import { createJavaScriptProjectSnapshot } from "../src/project-snapshot.js";
import {
  babelSourceReferenceParser,
  packageNameFromModuleSpecifier,
} from "../src/source-parser.js";
import {
  createSourceUsageEvidence,
  sourceUsageFactRule,
  withJavaScriptSourceUsage,
} from "../src/source-usage.js";
import { potentiallyUnnecessaryDependencyRule } from "../src/unnecessary-dependency.js";
import type { JavaScriptProjectSnapshot } from "../src/project-snapshot.js";

const scoreLimitation: AnalysisLimitation = {
  id: "limitation-source-usage-score",
  kind: "insufficient_evidence",
  message: "Static source usage does not yet define production StackLens health scores.",
  affectedCategories: ["dependencies"],
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
  id: "TEST-PRIORITY-SOURCE-USAGE",
  version: "1",
  requirementIds: ["FR-016"],
  prioritize(_context, finding) {
    return {
      level: "low",
      rule: {
        id: "TEST-PRIORITY-SOURCE-USAGE",
        version: "1",
      },
      rationale: "Test-only priority verifies FR-009 analyzer integration.",
      factors: [
        {
          key: "test-only",
          rationale: "This factor is not production priority policy.",
          evidenceIds: [finding.evidenceIds[0]!],
        },
      ],
    };
  },
};

const scorer: AnalysisScorer = {
  version: "test-score-source-usage",
  score() {
    return createInsufficientEvidenceScores();
  },
};

const analyzer: AnalyzerDefinition<JavaScriptProjectSnapshot, unknown> = {
  version: "test-analyzer-source-usage",
  ruleSet: {
    version: "rules-javascript-source-usage",
    factRules: [dependencyInventoryRule, sourceUsageFactRule],
    findingRules: [potentiallyUnnecessaryDependencyRule],
    prioritizer: testPrioritizer,
    recommendationRules: [],
  },
  scorer,
};

describe("source parser adapter [FR-009, SEC-001, SEC-002]", () => {
  it("detects supported static ESM/CommonJS/dynamic imports without executing source", () => {
    const parsed = babelSourceReferenceParser.parse(
      "src/index.ts",
      [
        'import React from "react";',
        'export { value } from "@scope/pkg/subpath";',
        'const lodash = require("lodash/fp");',
        'const ky = import("ky");',
        'const local = import("./local");',
      ].join("\n"),
    );

    expect(parsed.issues).toEqual([]);
    expect(parsed.references.map((reference) => [reference.kind, reference.specifier])).toEqual([
      ["esm_export", "@scope/pkg/subpath"],
      ["dynamic_import", "./local"],
      ["dynamic_import", "ky"],
      ["commonjs_require", "lodash/fp"],
      ["esm_import", "react"],
    ]);
  });

  it("marks non-static dynamic references and parse failures as uncertainty", () => {
    const dynamic = babelSourceReferenceParser.parse(
      "src/dynamic.ts",
      'const name = "react"; require(name); import(name);',
    );
    const invalid = babelSourceReferenceParser.parse("src/invalid.ts", "const = ;");

    expect(dynamic.issues.map((issue) => issue.kind)).toEqual([
      "dynamic_reference",
      "dynamic_reference",
    ]);
    expect(invalid.issues).toEqual([
      expect.objectContaining({
        kind: "parse_failure",
      }),
    ]);
  });

  it("normalizes external package subpaths and ignores local/builtin/protocol specifiers", () => {
    expect(packageNameFromModuleSpecifier("@scope/pkg/subpath")).toBe("@scope/pkg");
    expect(packageNameFromModuleSpecifier("lodash/fp")).toBe("lodash");
    expect(packageNameFromModuleSpecifier("./local")).toBeUndefined();
    expect(packageNameFromModuleSpecifier("node:fs")).toBeUndefined();
    expect(packageNameFromModuleSpecifier("https://example.com/mod.js")).toBeUndefined();
  });
});

describe("static source usage and potentially unnecessary dependency analysis [FR-009]", () => {
  it("uses source/config/script evidence and emits one conservative heuristic for an unreferenced dependency", () => {
    const manifest = normalizePackageManifest({
      dependencies: {
        react: "19.0.0",
        unused: "1.0.0",
      },
      devDependencies: {
        vite: "8.0.0",
        vitest: "5.0.1",
      },
      peerDependencies: {
        "peer-contract": "^2.0.0",
      },
    });
    const baseProject = createJavaScriptProjectSnapshot(
      manifest,
      [
        {
          path: "src/App.tsx",
          content: 'import React from "react"; export const App = () => <div>{React.version}</div>;',
        },
        {
          path: "vite.config.ts",
          content: "export default {};",
        },
      ],
      {
        scripts: [{ name: "test", command: "vitest run" }],
      },
    );
    const project = withJavaScriptSourceUsage(baseProject, "complete");
    const evidence = [
      ...createDependencyInventoryEvidence(project),
      ...createSourceUsageEvidence(project),
    ];

    const report = runAnalyzer(analyzer, {
      analysisId: "analysis-source-usage",
      createdAt: "2026-09-19T15:00:00Z",
      input: {
        type: "repository",
        fingerprint: "github:fixture:source-usage",
        repository: {
          provider: "github",
          owner: "stacklens-fixture",
          name: "source-usage",
          commitSha: "a".repeat(40),
          ref: "main",
        },
      },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [scoreLimitation],
    });

    expect(
      report.facts
        .filter((fact) => fact.type === "dependency.usage.static")
        .map((fact) => fact.subject.name),
    ).toEqual(["react", "vite", "vitest"]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      classification: "heuristic",
      category: "dependencies",
      subject: {
        type: "dependency",
        name: "unused",
      },
      rule: {
        id: "JS-UNNECESSARY-009",
        version: "1",
      },
      confidence: {
        level: "medium",
      },
    });
    expect(report.findings[0]?.description).toContain("not proof");
    expect(report.findings.some((finding) => finding.subject.name === "peer-contract")).toBe(false);
    expect(report.recommendations).toEqual([]);
    expect(report.scores.overall.status).toBe("insufficient_evidence");
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });

  it("suppresses absence-based findings when acquisition or parsing is incomplete", () => {
    const manifest = normalizePackageManifest({
      dependencies: {
        react: "19.0.0",
        unused: "1.0.0",
      },
    });
    const baseProject = createJavaScriptProjectSnapshot(manifest, [
      {
        path: "src/index.ts",
        content: 'const packageName = process.env.PACKAGE; require(packageName);',
      },
    ]);
    const project = withJavaScriptSourceUsage(baseProject, "complete");
    const evidence = [
      ...createDependencyInventoryEvidence(project),
      ...createSourceUsageEvidence(project),
    ];

    expect(project.sourceUsage?.coverage).toBe("partial");

    const report = runAnalyzer(analyzer, {
      analysisId: "analysis-source-usage-partial",
      createdAt: "2026-09-19T15:00:00Z",
      input: {
        type: "repository",
        fingerprint: "github:fixture:source-usage-partial",
        repository: {
          provider: "github",
          owner: "stacklens-fixture",
          name: "source-usage-partial",
          commitSha: "b".repeat(40),
          ref: "main",
        },
      },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [scoreLimitation],
    });

    expect(report.findings).toEqual([]);
    expect(report.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "insufficient_evidence",
          ruleIds: ["JS-USAGE-009"],
          message: expect.stringContaining("will not infer dependency non-use"),
        }),
      ]),
    );
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });
});
