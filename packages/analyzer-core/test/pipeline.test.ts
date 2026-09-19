import { describe, expect, it } from "vitest";

import type { AnalysisContext } from "../src/context.js";
import { AnalyzerConfigurationError } from "../src/errors.js";
import { runRulePipeline } from "../src/pipeline.js";
import type { AnalysisRuleSet } from "../src/rules.js";

import {
  createFact,
  createFinding,
  createRecommendation,
  projectEvidence
} from "./fixture.js";

interface ProjectSnapshot {
  readonly packageName: string;
}

interface MetadataSnapshot {
  readonly registryAvailable: boolean;
}

const context: AnalysisContext<ProjectSnapshot, MetadataSnapshot> = {
  input: {
    type: "manifest",
    fingerprint: "sha256:fixture"
  },
  project: {
    packageName: "fixture"
  },
  metadata: {
    registryAvailable: true
  },
  sources: [],
  evidence: [projectEvidence],
  limitations: [],
  partialFailures: []
};

describe("runRulePipeline", () => {
  it("runs rules in stable ID order and passes only prior-stage outputs forward", () => {
    const executionOrder: string[] = [];
    const visibleFactIds: string[][] = [];
    const visibleFindingIds: string[][] = [];

    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-Z",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            executionOrder.push("FACT-Z");
            return {
              facts: [createFact("FACT-Z", "fact-z")]
            };
          }
        },
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            executionOrder.push("FACT-A");
            return {
              facts: [createFact("FACT-A", "fact-a")]
            };
          }
        }
      ],
      findingRules: [
        {
          kind: "finding",
          id: "FINDING-A",
          version: "1",
          requirementIds: ["FR-017"],
          evaluate(ruleContext) {
            executionOrder.push("FINDING-A");
            visibleFactIds.push(ruleContext.facts.map((fact) => fact.id));
            return {
              findings: [createFinding("FINDING-A", "finding-a", "fact-a")]
            };
          }
        }
      ],
      recommendationRules: [
        {
          kind: "recommendation",
          id: "RECOMMENDATION-A",
          version: "1",
          requirementIds: ["FR-015"],
          evaluate(ruleContext) {
            executionOrder.push("RECOMMENDATION-A");
            visibleFindingIds.push(ruleContext.findings.map((finding) => finding.id));
            return {
              recommendations: [
                createRecommendation(
                  "RECOMMENDATION-A",
                  "recommendation-a",
                  "finding-a"
                )
              ]
            };
          }
        }
      ]
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(executionOrder).toEqual([
      "FACT-A",
      "FACT-Z",
      "FINDING-A",
      "RECOMMENDATION-A"
    ]);
    expect(result.facts.map((fact) => fact.id)).toEqual(["fact-a", "fact-z"]);
    expect(visibleFactIds).toEqual([["fact-a", "fact-z"]]);
    expect(visibleFindingIds).toEqual([["finding-a"]]);
    expect(result.recommendations.map((recommendation) => recommendation.id)).toEqual([
      "recommendation-a"
    ]);
  });

  it("isolates a throwing rule and continues unrelated rules", () => {
    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            return {
              facts: [createFact("FACT-A", "fact-a")]
            };
          }
        },
        {
          kind: "fact",
          id: "FACT-BROKEN",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            throw new Error("fixture failure");
          }
        }
      ],
      findingRules: [],
      recommendationRules: []
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.facts.map((fact) => fact.id)).toEqual(["fact-a"]);
    expect(result.partialFailures).toEqual([
      {
        id: "FACT-BROKEN",
        scope: "rule",
        rule: {
          id: "FACT-BROKEN",
          version: "1"
        },
        code: "rule_evaluation_failed",
        message: "Rule FACT-BROKEN could not complete deterministic evaluation.",
        retryable: false,
        occurredAt: "2026-09-19T03:00:00Z"
      }
    ]);
    expect(result.limitations[0]?.ruleIds).toEqual(["FACT-BROKEN"]);
  });

  it("isolates a rule that emits contract data owned by another rule", () => {
    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            return {
              facts: [createFact("OTHER-RULE", "fact-invalid")]
            };
          }
        }
      ],
      findingRules: [],
      recommendationRules: []
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.facts).toEqual([]);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures[0]?.scope).toBe("rule");
  });

  it("rejects duplicate rule IDs before any rule evaluates", () => {
    let evaluations = 0;

    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "DUPLICATE",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            evaluations += 1;
            return {};
          }
        }
      ],
      findingRules: [
        {
          kind: "finding",
          id: "DUPLICATE",
          version: "1",
          requirementIds: ["FR-017"],
          evaluate() {
            evaluations += 1;
            return {};
          }
        }
      ],
      recommendationRules: []
    };

    expect(() =>
      runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z")
    ).toThrowError(AnalyzerConfigurationError);
    expect(evaluations).toBe(0);
  });

  it("requires every rule to declare requirement traceability", () => {
    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: [],
          evaluate() {
            return {};
          }
        }
      ],
      findingRules: [],
      recommendationRules: []
    };

    expect(() =>
      runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z")
    ).toThrowError(/must declare at least one requirement ID/);
  });
});
