import { describe, expect, it } from "vitest";

import type { AnalysisContext } from "../src/context.js";
import { AnalyzerConfigurationError } from "../src/errors.js";
import { runRulePipeline } from "../src/pipeline.js";
import type { FindingPrioritizer } from "../src/priority.js";
import type { AnalysisRuleSet } from "../src/rules.js";
import {
  createFact,
  createFindingCandidate,
  createPriority,
  createRecommendation,
  projectEvidence,
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
    fingerprint: "sha256:fixture",
  },
  project: {
    packageName: "fixture",
  },
  metadata: {
    registryAvailable: true,
  },
  sources: [],
  evidence: [projectEvidence],
  limitations: [],
  partialFailures: [],
};

function createPrioritizer(
  overrides: Partial<FindingPrioritizer<ProjectSnapshot, MetadataSnapshot>> = {},
): FindingPrioritizer<ProjectSnapshot, MetadataSnapshot> {
  return {
    kind: "priority",
    id: "PRIORITY-001",
    version: "1",
    requirementIds: ["FR-016"],
    prioritize() {
      return createPriority();
    },
    ...overrides,
  };
}

describe("runRulePipeline", () => {
  it("runs deterministic stages and exposes only completed prior-stage output", () => {
    const executionOrder: string[] = [];
    const visibleFactIds: string[][] = [];
    const visibleCandidateIds: string[][] = [];
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
              facts: [createFact("FACT-Z", "fact-z")],
            };
          },
        },
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            executionOrder.push("FACT-A");
            return {
              facts: [createFact("FACT-A", "fact-a")],
            };
          },
        },
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
              findings: [createFindingCandidate("FINDING-A", "finding-a", "fact-a")],
            };
          },
        },
      ],
      prioritizer: createPrioritizer({
        prioritize(priorityContext) {
          executionOrder.push("PRIORITY-001");
          visibleCandidateIds.push(priorityContext.findings.map((finding) => finding.id));
          return createPriority();
        },
      }),
      recommendationRules: [
        {
          kind: "recommendation",
          id: "RECOMMENDATION-A",
          version: "1",
          requirementIds: ["FR-015"],
          evaluate(ruleContext) {
            executionOrder.push("RECOMMENDATION-A");
            visibleFindingIds.push(ruleContext.findings.map((finding) => finding.id));
            expect(ruleContext.findings[0]?.priority.rule.id).toBe("PRIORITY-001");
            return {
              recommendations: [
                createRecommendation("RECOMMENDATION-A", "recommendation-a", "finding-a"),
              ],
            };
          },
        },
      ],
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(executionOrder).toEqual([
      "FACT-A",
      "FACT-Z",
      "FINDING-A",
      "PRIORITY-001",
      "RECOMMENDATION-A",
    ]);
    expect(result.facts.map((fact) => fact.id)).toEqual(["fact-a", "fact-z"]);
    expect(visibleFactIds).toEqual([["fact-a", "fact-z"]]);
    expect(visibleCandidateIds).toEqual([["finding-a"]]);
    expect(visibleFindingIds).toEqual([["finding-a"]]);
    expect(result.findings[0]?.priority.level).toBe("low");
    expect(result.recommendations.map((recommendation) => recommendation.id)).toEqual([
      "recommendation-a",
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
              facts: [createFact("FACT-A", "fact-a")],
            };
          },
        },
        {
          kind: "fact",
          id: "FACT-BROKEN",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            throw new Error("fixture failure");
          },
        },
      ],
      findingRules: [],
      prioritizer: createPrioritizer(),
      recommendationRules: [],
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.facts.map((fact) => fact.id)).toEqual(["fact-a"]);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures[0]).toMatchObject({
      scope: "rule",
      rule: {
        id: "FACT-BROKEN",
        version: "1",
      },
      code: "rule_evaluation_failed",
      retryable: false,
      occurredAt: "2026-09-19T03:00:00Z",
    });
    expect(result.partialFailures[0]?.id).toContain("FACT-BROKEN");
    expect(result.limitations[0]?.ruleIds).toEqual(["FACT-BROKEN"]);
  });

  it("isolates schema-valid rule output that references unknown evidence", () => {
    const invalidFact = {
      ...createFact("FACT-A", "fact-invalid"),
      evidenceIds: ["missing-evidence"],
    };

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
              facts: [invalidFact],
            };
          },
        },
      ],
      findingRules: [],
      prioritizer: createPrioritizer(),
      recommendationRules: [],
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.facts).toEqual([]);
    expect(result.partialFailures[0]?.code).toBe("rule_output_invalid");
  });

  it("isolates a finding when priority evaluation fails", () => {
    let recommendationFindingIds: string[] | undefined;

    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            return { facts: [createFact("FACT-A", "fact-a")] };
          },
        },
      ],
      findingRules: [
        {
          kind: "finding",
          id: "FINDING-A",
          version: "1",
          requirementIds: ["FR-017"],
          evaluate() {
            return {
              findings: [createFindingCandidate("FINDING-A", "finding-a", "fact-a")],
            };
          },
        },
      ],
      prioritizer: createPrioritizer({
        prioritize() {
          throw new Error("fixture priority failure");
        },
      }),
      recommendationRules: [
        {
          kind: "recommendation",
          id: "RECOMMENDATION-A",
          version: "1",
          requirementIds: ["FR-015"],
          evaluate(ruleContext) {
            recommendationFindingIds = ruleContext.findings.map((finding) => finding.id);
            return {};
          },
        },
      ],
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.findings).toEqual([]);
    expect(recommendationFindingIds).toEqual([]);
    expect(result.partialFailures[0]).toMatchObject({
      rule: { id: "PRIORITY-001" },
      code: "priority_evaluation_failed",
    });
    expect(result.limitations[0]?.affectedCategories).toEqual(["dependencies"]);
  });

  it("isolates a priority result owned by another priority rule", () => {
    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-A",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            return { facts: [createFact("FACT-A", "fact-a")] };
          },
        },
      ],
      findingRules: [
        {
          kind: "finding",
          id: "FINDING-A",
          version: "1",
          requirementIds: ["FR-017"],
          evaluate() {
            return {
              findings: [createFindingCandidate("FINDING-A", "finding-a", "fact-a")],
            };
          },
        },
      ],
      prioritizer: createPrioritizer({
        prioritize() {
          return createPriority("OTHER-PRIORITY");
        },
      }),
      recommendationRules: [],
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.findings).toEqual([]);
    expect(result.partialFailures[0]?.code).toBe("priority_output_invalid");
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
              facts: [createFact("OTHER-RULE", "fact-invalid")],
            };
          },
        },
      ],
      findingRules: [],
      prioritizer: createPrioritizer(),
      recommendationRules: [],
    };

    const result = runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z");

    expect(result.facts).toEqual([]);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures[0]?.code).toBe("rule_output_invalid");
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
          },
        },
      ],
      findingRules: [],
      prioritizer: createPrioritizer({
        id: "DUPLICATE",
        prioritize() {
          evaluations += 1;
          return createPriority("DUPLICATE");
        },
      }),
      recommendationRules: [],
    };

    expect(() => runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z")).toThrowError(
      AnalyzerConfigurationError,
    );
    expect(evaluations).toBe(0);
  });

  it("requires every rule-stage component to declare requirement traceability", () => {
    const ruleSet: AnalysisRuleSet<ProjectSnapshot, MetadataSnapshot> = {
      version: "1",
      factRules: [],
      findingRules: [],
      prioritizer: createPrioritizer({
        requirementIds: [],
      }),
      recommendationRules: [],
    };

    expect(() => runRulePipeline(context, ruleSet, "2026-09-19T03:00:00Z")).toThrowError(
      /must declare at least one requirement ID/,
    );
  });
});
