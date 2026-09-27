import type { AnalysisScorer, ScoringContext } from "@stacklens/analyzer-core";
import type {
  AnalysisFact,
  AnalysisLimitation,
  AnalysisScores,
  AvailableScore,
  Finding,
  InsufficientEvidenceScore,
  PriorityLevel,
  ScoreCategory,
  ScoreContribution,
  ScoreResult,
} from "@stacklens/contracts";

const SCORE_RULE_ID = "SCORE-STACK-001";
export const STACK_HEALTH_SCORING_VERSION = "stack-health-v2";

const CATEGORY_ORDER: readonly ScoreCategory[] = [
  "dependencies",
  "security",
  "maintainability",
  "testing",
  "tooling",
];

const SUPPORTED_OVERALL_CATEGORIES = CATEGORY_ORDER;

const SCORED_RULES: Readonly<Record<ScoreCategory, readonly string[]>> = {
  dependencies: ["JS-NPM-006", "JS-NPM-007", "JS-OVERLAP-008"],
  security: ["JS-VULN-011"],
  maintainability: ["JS-MIGRATION-014"],
  testing: ["JS-SETUP-019"],
  tooling: ["JS-SETUP-019"],
};

const PRIORITY_DEDUCTIONS: Readonly<Record<PriorityLevel, number>> = {
  critical: 40,
  high: 25,
  medium: 12,
  low: 5,
};

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function stableHash(value: string): string {
  let hash = FNV_OFFSET_BASIS_64;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & UINT64_MASK;
  }

  return hash.toString(16).padStart(16, "0");
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function coverageFactType(category: ScoreCategory): string {
  return `analysis.coverage.${category}`;
}

function categoryCoverageFacts(
  facts: readonly AnalysisFact[],
  category: ScoreCategory,
): readonly AnalysisFact[] {
  return facts
    .filter(
      (fact) =>
        fact.type === coverageFactType(category) && fact.subject.type === "analysis_coverage",
    )
    .toSorted((left, right) => compareCodeUnits(left.id, right.id));
}

function categoryLimitations(
  limitations: readonly AnalysisLimitation[],
  category: ScoreCategory,
): readonly AnalysisLimitation[] {
  return limitations
    .filter(
      (limitation) =>
        (limitation.kind === "partial_failure" &&
          limitation.ruleIds.length > 0 &&
          limitation.affectedCategories.length === 0) ||
        limitation.ruleIds.some(
          (id) => id !== "JS-SETUP-019" && SCORED_RULES[category].includes(id),
        ) ||
        (limitation.affectedCategories.includes(category) &&
          (limitation.ruleIds.some(
            (id) =>
              id === "JS-COVERAGE-018" ||
              id === "JS-READINESS-019" ||
              SCORED_RULES[category].includes(id),
          ) ||
            (limitation.kind === "partial_failure" && limitation.ruleIds.length > 0))),
    )
    .toSorted((left, right) => compareCodeUnits(left.id, right.id));
}

function contributionId(finding: Finding): string {
  return `score-contribution-${stableHash(
    JSON.stringify([STACK_HEALTH_SCORING_VERSION, finding.id]),
  )}`;
}

function findingContribution(finding: Finding): ScoreContribution {
  const points = PRIORITY_DEDUCTIONS[finding.priority.level];

  return {
    id: contributionId(finding),
    category: finding.category,
    direction: "deduction",
    points,
    rationale:
      `${finding.title} Priority ${finding.priority.level} deducts ${points} point(s) ` +
      `from the ${finding.category} category.`,
    rule: {
      id: SCORE_RULE_ID,
      version: "2",
    },
    findingIds: [finding.id],
    factIds: [],
    evidenceIds: [...finding.evidenceIds],
  };
}

function insufficientScore(limitations: readonly AnalysisLimitation[]): InsufficientEvidenceScore {
  if (limitations.length === 0) {
    throw new Error(
      "StackLens scoring requires an explicit category limitation when coverage is unavailable.",
    );
  }

  return {
    status: "insufficient_evidence",
    evidenceCoverage: 0,
    limitationIds: limitations.map((limitation) => limitation.id),
  };
}

function availableCategoryScore(
  category: ScoreCategory,
  findings: readonly Finding[],
): { readonly score: AvailableScore; readonly contributions: readonly ScoreContribution[] } {
  const contributions = findings
    .filter(
      (finding) =>
        finding.category === category && SCORED_RULES[category].includes(finding.rule.id),
    )
    .toSorted((left, right) => compareCodeUnits(left.id, right.id))
    .map(findingContribution);
  const deductions = contributions.reduce((total, contribution) => total + contribution.points, 0);

  return {
    score: {
      status: "available",
      evidenceCoverage: 100,
      value: Math.max(0, 100 - deductions),
      contributionIds: contributions.map((contribution) => contribution.id),
    },
    contributions,
  };
}

function scoreCategory(
  context: ScoringContext,
  category: ScoreCategory,
): { readonly score: ScoreResult; readonly contributions: readonly ScoreContribution[] } {
  const limitations = categoryLimitations(context.limitations, category);
  const coverageFacts = categoryCoverageFacts(context.facts, category);

  if (limitations.length > 0 || coverageFacts.length === 0) {
    return {
      score: insufficientScore(
        limitations.length > 0
          ? limitations
          : context.limitations.filter((limitation) =>
              limitation.affectedCategories.includes(category),
            ),
      ),
      contributions: [],
    };
  }

  return availableCategoryScore(category, context.findings);
}

function availableScoreValue(score: ScoreResult): number | undefined {
  return score.status === "available" ? score.value : undefined;
}

function overallScore(
  categories: Record<ScoreCategory, ScoreResult>,
  contributions: readonly ScoreContribution[],
): ScoreResult {
  const requiredScores = SUPPORTED_OVERALL_CATEGORIES.map((category) => categories[category]);
  const availableValues = requiredScores.flatMap((score) => {
    const value = availableScoreValue(score);
    return value === undefined ? [] : [value];
  });

  if (availableValues.length !== SUPPORTED_OVERALL_CATEGORIES.length) {
    const limitationIds = requiredScores.flatMap((score) =>
      score.status === "insufficient_evidence" ? score.limitationIds : [],
    );

    if (limitationIds.length === 0) {
      throw new Error(
        "Overall scoring requires explicit limitations when a supported category is unavailable.",
      );
    }

    return {
      status: "insufficient_evidence",
      evidenceCoverage: (availableValues.length / CATEGORY_ORDER.length) * 100,
      limitationIds: [...new Set(limitationIds)].toSorted(compareCodeUnits),
    };
  }

  const value =
    Math.round(
      (availableValues.reduce((total, categoryValue) => total + categoryValue, 0) /
        availableValues.length) *
        100,
    ) / 100;
  const supportedContributionIds = contributions
    .filter((contribution) => SUPPORTED_OVERALL_CATEGORIES.includes(contribution.category))
    .map((contribution) => contribution.id);

  return {
    status: "available",
    evidenceCoverage: (SUPPORTED_OVERALL_CATEGORIES.length / CATEGORY_ORDER.length) * 100,
    value,
    contributionIds: supportedContributionIds,
  };
}

export const stackHealthScorer: AnalysisScorer = {
  version: STACK_HEALTH_SCORING_VERSION,
  score(context): AnalysisScores {
    const categoryResults = {
      dependencies: scoreCategory(context, "dependencies"),
      security: scoreCategory(context, "security"),
      maintainability: scoreCategory(context, "maintainability"),
      testing: scoreCategory(context, "testing"),
      tooling: scoreCategory(context, "tooling"),
    } satisfies Record<
      ScoreCategory,
      { readonly score: ScoreResult; readonly contributions: readonly ScoreContribution[] }
    >;
    const contributions = CATEGORY_ORDER.flatMap(
      (category) => categoryResults[category].contributions,
    ).toSorted((left, right) => compareCodeUnits(left.id, right.id));
    const categories: Record<ScoreCategory, ScoreResult> = {
      dependencies: categoryResults.dependencies.score,
      security: categoryResults.security.score,
      maintainability: categoryResults.maintainability.score,
      testing: categoryResults.testing.score,
      tooling: categoryResults.tooling.score,
    };

    return {
      overall: overallScore(categories, contributions),
      categories,
      contributions,
    };
  },
};
