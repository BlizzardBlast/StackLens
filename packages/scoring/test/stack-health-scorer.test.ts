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
      id: {
        dependencies: "JS-NPM-006",
        security: "JS-VULN-011",
        maintainability: "JS-MIGRATION-014",
        testing: "JS-SETUP-019",
        tooling: "JS-SETUP-019",
      }[category],
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
      status: "insufficient_evidence",
      evidenceCoverage: 40,
      limitationIds: ["limitation-maintainability", "limitation-testing", "limitation-tooling"],
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
      limitationIds: [
        "limitation-dependencies",
        "limitation-maintainability",
        "limitation-testing",
        "limitation-tooling",
      ],
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

    expect(stackHealthScorer.score(context)).toEqual(
      stackHealthScorer.score({
        ...context,
        facts: context.facts.toReversed(),
        findings: context.findings.toReversed(),
        limitations: context.limitations.toReversed(),
      }),
    );
  });

  it("averages all five scoped scores and excludes unscored source-usage heuristics [SCORE-004]", () => {
    const unused = {
      ...finding("unused", "dependencies", "low"),
      rule: { id: "JS-UNNECESSARY-009", version: "1" },
    };
    const scores = stackHealthScorer.score({
      sources: [],
      evidence: [],
      partialFailures: [],
      facts: (["dependencies", "security", "maintainability", "testing", "tooling"] as const).map(
        coverageFact,
      ),
      findings: [
        finding("migration", "maintainability", "medium"),
        finding("test-setup", "testing", "low"),
        unused,
      ],
      limitations: [
        { ...unavailableCategory("dependencies"), id: "source-partial", ruleIds: ["JS-USAGE-009"] },
      ],
    });
    expect(scores.categories.dependencies).toMatchObject({ status: "available", value: 100 });
    expect(scores.categories.maintainability).toMatchObject({ status: "available", value: 88 });
    expect(scores.categories.testing).toMatchObject({ status: "available", value: 95 });
    expect(scores.overall).toMatchObject({
      status: "available",
      value: 96.6,
      evidenceCoverage: 100,
    });
    expect(scores.contributions).toHaveLength(2);
    expect(scores.contributions.every((item) => item.rule.version === "2")).toBe(true);
  });

  it("blocks a score when a rule failure could hide findings even with a coverage fact", () => {
    const scores = stackHealthScorer.score({
      sources: [],
      evidence: [],
      partialFailures: [],
      findings: [],
      facts: (["dependencies", "security", "maintainability", "testing", "tooling"] as const).map(
        coverageFact,
      ),
      limitations: [
        {
          ...unavailableCategory("dependencies"),
          kind: "partial_failure",
          ruleIds: ["JS-NPM-006"],
          affectedCategories: [],
        },
      ],
    });
    expect(scores.categories.dependencies.status).toBe("insufficient_evidence");
    expect(
      Object.values(scores.categories).every((score) => score.status === "insufficient_evidence"),
    ).toBe(true);
    expect(scores.overall.status).toBe("insufficient_evidence");
  });
  it("maps detector limitations to the scored scope even when their original area differs", () => {
    const scores = stackHealthScorer.score({
      sources: [],
      evidence: [],
      partialFailures: [],
      findings: [],
      facts: (["dependencies", "security", "maintainability", "testing", "tooling"] as const).map(
        coverageFact,
      ),
      limitations: [{ ...unavailableCategory("dependencies"), ruleIds: ["JS-MIGRATION-014"] }],
    });
    expect(scores.categories.dependencies.status).toBe("available");
    expect(scores.categories.maintainability.status).toBe("insufficient_evidence");
    expect(scores.overall.status).toBe("insufficient_evidence");
  });
});
