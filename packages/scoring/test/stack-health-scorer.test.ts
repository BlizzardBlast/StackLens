import { describe, expect, it } from "vitest";

import { AnalysisScoresSchema } from "@stacklens/contracts";
import type {
  AnalysisFact,
  AnalysisLimitation,
  Finding,
  ScoreCategory,
} from "@stacklens/contracts";

import { STACK_HEALTH_SCORING_VERSION, stackHealthScorer } from "../src/index.js";

function coverageFact(category: ScoreCategory): AnalysisFact {
  return {
    id: `fact-coverage-${category}`,
    type: `analysis.coverage.${category}`,
    subject: {
      type: "analysis_coverage",
      name: `${category} scoring coverage`,
    },
    statement: `${category} evidence coverage is complete for this fixture.`,
    rule: {
      id: "JS-COVERAGE-018",
      version: "1",
    },
    requirementIds: ["FR-019"],
    evidenceIds: [`evidence-${category}`],
  };
}

function unavailableCategory(category: ScoreCategory): AnalysisLimitation {
  return {
    id: `limitation-${category}`,
    kind: "insufficient_evidence",
    message: `${category} score is intentionally unavailable in this fixture.`,
    affectedCategories: [category],
    sourceIds: [],
    ruleIds: ["JS-COVERAGE-018"],
  };
}

function finding(
  id: string,
  category: ScoreCategory,
  level: "critical" | "high" | "medium" | "low",
): Finding {
  return {
    id,
    category,
    classification: "fact",
    subject: {
      type: "dependency",
      name: id,
      path: "package.json",
    },
    title: id,
    description: `Fixture finding ${id}.`,
    rule: {
      id: "TEST-FINDING",
      version: "1",
    },
    requirementIds: ["FR-016"],
    evidenceIds: [`evidence-${id}`],
    factIds: [],
    limitationIds: [],
    priority: {
      level,
      rule: {
        id: "JS-PRIORITY-016",
        version: "1",
      },
      rationale: `Fixture priority ${level}.`,
      factors: [
        {
          key: "fixture-priority",
          rationale: "Fixture priority factor.",
          evidenceIds: [`evidence-${id}`],
        },
      ],
    },
  };
}

describe("stack health scorer [FR-018, FR-019, FR-020, SCORE-001, SCORE-002, SCORE-003]", () => {
  it("scores only categories with explicit coverage and explains every deduction", () => {
    const scores = stackHealthScorer.score({
      sources: [],
      evidence: [],
      facts: [coverageFact("dependencies"), coverageFact("security")],
      findings: [
        finding("finding-dependency-low", "dependencies", "low"),
        finding("finding-security-high", "security", "high"),
        finding("finding-maintainability-medium", "maintainability", "medium"),
      ],
      limitations: [
        unavailableCategory("maintainability"),
        unavailableCategory("testing"),
        unavailableCategory("tooling"),
      ],
      partialFailures: [],
    });

    expect(stackHealthScorer.version).toBe(STACK_HEALTH_SCORING_VERSION);
    expect(scores.categories.dependencies).toEqual({
      status: "available",
      evidenceCoverage: 100,
      value: 95,
      contributionIds: [expect.any(String)],
    });
    expect(scores.categories.security).toEqual({
      status: "available",
      evidenceCoverage: 100,
      value: 75,
      contributionIds: [expect.any(String)],
    });
    expect(scores.categories.maintainability).toEqual({
      status: "insufficient_evidence",
      evidenceCoverage: 0,
      limitationIds: ["limitation-maintainability"],
    });
    expect(scores.overall).toEqual({
      status: "available",
      evidenceCoverage: 40,
      value: 85,
      contributionIds: expect.any(Array),
    });
    expect(scores.contributions).toHaveLength(2);
    expect(scores.contributions.map((item) => item.points).toSorted((a, b) => a - b)).toEqual([
      5, 25,
    ]);
    expect(scores.contributions.every((item) => item.rule.id === "SCORE-STACK-001")).toBe(true);
    expect(AnalysisScoresSchema.safeParse(scores).success).toBe(true);
  });

  it("returns N/A instead of lowering a score when required evidence is unavailable", () => {
    const limitations = [
      unavailableCategory("dependencies"),
      unavailableCategory("maintainability"),
      unavailableCategory("testing"),
      unavailableCategory("tooling"),
    ];
    const scores = stackHealthScorer.score({
      sources: [],
      evidence: [],
      facts: [coverageFact("security")],
      findings: [finding("finding-security-high", "security", "high")],
      limitations,
      partialFailures: [],
    });

    expect(scores.categories.dependencies).toEqual({
      status: "insufficient_evidence",
      evidenceCoverage: 0,
      limitationIds: ["limitation-dependencies"],
    });
    expect(scores.categories.security).toMatchObject({
      status: "available",
      value: 75,
    });
    expect(scores.overall).toEqual({
      status: "insufficient_evidence",
      evidenceCoverage: 20,
      limitationIds: ["limitation-dependencies"],
    });
    expect(scores.contributions).toHaveLength(1);
    expect(AnalysisScoresSchema.safeParse(scores).success).toBe(true);
  });

  it("is deterministic for equivalent ordered input", () => {
    const context = {
      sources: [],
      evidence: [],
      facts: [coverageFact("security"), coverageFact("dependencies")],
      findings: [
        finding("finding-security-high", "security", "high"),
        finding("finding-dependency-low", "dependencies", "low"),
      ],
      limitations: [
        unavailableCategory("maintainability"),
        unavailableCategory("testing"),
        unavailableCategory("tooling"),
      ],
      partialFailures: [],
    };

    expect(stackHealthScorer.score(context)).toEqual(stackHealthScorer.score(context));
  });
});
