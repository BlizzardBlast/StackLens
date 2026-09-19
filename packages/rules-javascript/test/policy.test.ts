import { describe, expect, it } from "vitest";

import type { FindingCandidate, PrioritizationContext } from "@stacklens/analyzer-core";

import {
  createJavaScriptProjectSnapshot,
  javascriptFindingPrioritizer,
  normalizePackageManifest,
  scoringCoverageFactRule,
  withJavaScriptSourceUsage,
} from "../src/index.js";
import type {
  JavaScriptAnalysisMetadata,
  JavaScriptProjectSnapshot,
} from "../src/index.js";

function factualCandidate(ruleId: string, category: "dependencies" | "security"): FindingCandidate {
  return {
    id: `finding-${ruleId.toLowerCase()}`,
    category,
    classification: "fact",
    subject: {
      type: "dependency",
      name: "fixture-package",
      path: "package.json",
    },
    title: "Fixture finding",
    description: "Fixture factual finding.",
    rule: {
      id: ruleId,
      version: "1",
    },
    requirementIds: ["FR-016"],
    evidenceIds: ["evidence-fixture"],
    factIds: [],
    limitationIds: [],
  };
}

function heuristicCandidate(ruleId: string): FindingCandidate {
  return {
    id: `finding-${ruleId.toLowerCase()}`,
    category: "dependencies",
    classification: "heuristic",
    subject: {
      type: "dependency",
      name: "fixture-package",
      path: "package.json",
    },
    title: "Fixture heuristic",
    description: "Fixture heuristic finding.",
    rule: {
      id: ruleId,
      version: "1",
    },
    requirementIds: ["FR-016"],
    evidenceIds: ["evidence-fixture"],
    factIds: ["fact-fixture"],
    limitationIds: [],
    confidence: {
      level: "low",
      rationale: "Fixture low-confidence evidence.",
      factIds: ["fact-fixture"],
    },
  };
}

function priorityContext(
  finding: FindingCandidate,
): PrioritizationContext<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata> {
  return {
    input: {
      type: "manifest",
      fingerprint: "fixture-policy",
    },
    project: {
      dependencies: [],
    },
    metadata: {},
    sources: [],
    evidence: [],
    limitations: [],
    partialFailures: [],
    facts: [],
    findings: [finding],
  };
}

describe("JavaScript production priority policy [FR-016, FR-020]", () => {
  it("places known vulnerabilities and explicit deprecations ahead of routine maintenance", () => {
    const vulnerability = factualCandidate("JS-VULN-011", "security");
    const deprecation = factualCandidate("JS-NPM-007", "dependencies");

    expect(
      javascriptFindingPrioritizer.prioritize(priorityContext(vulnerability), vulnerability),
    ).toMatchObject({
      level: "high",
      rule: {
        id: "JS-PRIORITY-016",
        version: "1",
      },
      factors: [
        expect.objectContaining({
          key: "known-vulnerability",
        }),
      ],
    });
    expect(
      javascriptFindingPrioritizer.prioritize(priorityContext(deprecation), deprecation),
    ).toMatchObject({
      level: "high",
      factors: [
        expect.objectContaining({
          key: "explicit-deprecation",
        }),
      ],
    });
  });

  it("caps low-confidence heuristic urgency instead of allowing uncertainty to raise priority", () => {
    const candidate = heuristicCandidate("JS-UNNECESSARY-009");
    const priority = javascriptFindingPrioritizer.prioritize(
      priorityContext(candidate),
      candidate,
    );

    expect(priority.level).toBe("low");
    expect(priority.factors.map((factor) => factor.key)).toEqual([
      "potential-non-use",
      "evidence-strength",
    ]);
  });
});

describe("score coverage policy [FR-018, FR-019, FR-021, SCORE-003]", () => {
  it("emits limitations instead of score coverage when source and exact-version evidence are incomplete", () => {
    const manifest = normalizePackageManifest({
      dependencies: {
        react: "^18.2.0",
      },
    });
    const project = withJavaScriptSourceUsage(
      createJavaScriptProjectSnapshot(manifest, [
        {
          path: "src/index.ts",
          content: 'import React from "react"; export const value = React.version;',
        },
      ]),
      "partial",
    );
    const result = scoringCoverageFactRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fixture-coverage",
      },
      project,
      metadata: {},
      sources: [],
      evidence: [],
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts ?? []).toEqual([]);
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affectedCategories: ["dependencies"],
          message: expect.stringContaining("complete supported static"),
        }),
        expect.objectContaining({
          affectedCategories: ["security"],
          message: expect.stringContaining("complete bound OSV source"),
        }),
        expect.objectContaining({
          affectedCategories: ["maintainability"],
          message: expect.stringContaining("N/A"),
        }),
      ]),
    );
  });
});
