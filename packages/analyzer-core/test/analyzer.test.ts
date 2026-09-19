import { describe, expect, it, vi } from "vitest";

import { AnalysisReportSchema } from "@stacklens/contracts";

import { runAnalyzer } from "../src/analyzer.js";
import type { AnalyzerDefinition } from "../src/analyzer.js";
import type { AnalysisScorer } from "../src/scoring.js";
import {
  createFact,
  createFindingCandidate,
  createPriority,
  createRecommendation,
  createScores,
  projectEvidence,
} from "./fixture.js";

interface ProjectSnapshot {
  readonly packageName: string;
}

interface MetadataSnapshot {
  readonly registryAvailable: boolean;
}

function createDefinition(
  scorer: AnalysisScorer,
): AnalyzerDefinition<ProjectSnapshot, MetadataSnapshot> {
  return {
    version: "analyzer-v1",
    scorer,
    ruleSet: {
      version: "rules-v1",
      factRules: [
        {
          kind: "fact",
          id: "FACT-DEPENDENCY",
          version: "1",
          requirementIds: ["FR-005"],
          evaluate() {
            return {
              facts: [createFact("FACT-DEPENDENCY", "fact-dependency")],
            };
          },
        },
      ],
      findingRules: [
        {
          kind: "finding",
          id: "FINDING-DEPENDENCY",
          version: "1",
          requirementIds: ["FR-017"],
          evaluate() {
            return {
              findings: [
                createFindingCandidate(
                  "FINDING-DEPENDENCY",
                  "finding-dependency",
                  "fact-dependency",
                ),
              ],
            };
          },
        },
      ],
      prioritizer: {
        kind: "priority",
        id: "PRIORITY-DEPENDENCY",
        version: "1",
        requirementIds: ["FR-016"],
        prioritize() {
          return createPriority("PRIORITY-DEPENDENCY");
        },
      },
      recommendationRules: [
        {
          kind: "recommendation",
          id: "RECOMMENDATION-DEPENDENCY",
          version: "1",
          requirementIds: ["FR-015"],
          evaluate() {
            return {
              recommendations: [
                createRecommendation(
                  "RECOMMENDATION-DEPENDENCY",
                  "recommendation-dependency",
                  "finding-dependency",
                ),
              ],
            };
          },
        },
      ],
    },
  };
}

describe("runAnalyzer", () => {
  it("assembles a validated report through priority and scoring abstractions", () => {
    const score = vi.fn<AnalysisScorer["score"]>((context) => {
      expect(context.facts.map((fact) => fact.id)).toEqual(["fact-dependency"]);
      expect(context.findings.map((finding) => finding.id)).toEqual(["finding-dependency"]);
      expect(context.findings[0]?.priority.rule.id).toBe("PRIORITY-DEPENDENCY");
      expect(context.evidence.map((evidence) => evidence.id)).toEqual([projectEvidence.id]);

      return createScores("finding-dependency");
    });

    const scorer: AnalysisScorer = {
      version: "score-v1",
      score,
    };

    const report = runAnalyzer(createDefinition(scorer), {
      analysisId: "analysis-core-fixture",
      createdAt: "2026-09-19T03:00:00Z",
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
    });

    expect(score).toHaveBeenCalledOnce();
    expect(report.analyzer).toEqual({
      version: "analyzer-v1",
      ruleSetVersion: "rules-v1",
      scoringVersion: "score-v1",
    });
    expect(report.facts).toHaveLength(1);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.priority.rule.id).toBe("PRIORITY-DEPENDENCY");
    expect(report.recommendations).toHaveLength(1);
    expect(report.scores.overall).toMatchObject({
      status: "available",
      value: 95,
    });
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });

  it("does not create timestamps or IDs internally", () => {
    const scorer: AnalysisScorer = {
      version: "score-v1",
      score() {
        return createScores();
      },
    };

    const definition: AnalyzerDefinition<ProjectSnapshot, MetadataSnapshot> = {
      version: "analyzer-v1",
      scorer,
      ruleSet: {
        version: "rules-v1",
        factRules: [],
        findingRules: [],
        prioritizer: {
          kind: "priority",
          id: "PRIORITY-EMPTY",
          version: "1",
          requirementIds: ["FR-016"],
          prioritize() {
            return createPriority("PRIORITY-EMPTY");
          },
        },
        recommendationRules: [],
      },
    };

    const report = runAnalyzer(definition, {
      analysisId: "caller-owned-id",
      createdAt: "2026-09-19T03:01:02Z",
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
      evidence: [],
    });

    expect(report.analysisId).toBe("caller-owned-id");
    expect(report.createdAt).toBe("2026-09-19T03:01:02Z");
  });

  it("rejects an invalid analyzer definition before evaluating rules", () => {
    let evaluations = 0;
    const scorer: AnalysisScorer = {
      version: "score-v1",
      score() {
        return createScores();
      },
    };

    const definition = createDefinition(scorer);
    const invalidDefinition: AnalyzerDefinition<ProjectSnapshot, MetadataSnapshot> = {
      ...definition,
      version: "",
      ruleSet: {
        ...definition.ruleSet,
        factRules: [
          {
            ...definition.ruleSet.factRules[0]!,
            evaluate() {
              evaluations += 1;
              return {};
            },
          },
        ],
      },
    };

    expect(() =>
      runAnalyzer(invalidDefinition, {
        analysisId: "analysis-invalid-definition",
        createdAt: "2026-09-19T03:02:00Z",
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
      }),
    ).toThrowError(/Analyzer version/);

    expect(evaluations).toBe(0);
  });
});
