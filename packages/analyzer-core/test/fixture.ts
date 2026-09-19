import type {
  AnalysisFact,
  AnalysisLimitation,
  AnalysisScores,
  Evidence,
  FindingPriority,
  Recommendation,
} from "@stacklens/contracts";

import type { FindingCandidate } from "../src/priority.js";

export const projectEvidence: Evidence = {
  id: "evidence-manifest",
  kind: "project",
  summary: "legacy-tool is declared in package.json.",
  location: {
    path: "package.json",
    startLine: 10,
    endLine: 10,
  },
};

export function createFact(ruleId: string, id: string): AnalysisFact {
  return {
    id,
    type: "dependency.declared",
    subject: {
      type: "dependency",
      name: "legacy-tool",
    },
    statement: "legacy-tool is declared by the analyzed project.",
    rule: {
      id: ruleId,
      version: "1",
    },
    requirementIds: ["FR-005"],
    evidenceIds: [projectEvidence.id],
  };
}

export function createFindingCandidate(
  ruleId: string,
  id: string,
  factId: string,
): FindingCandidate {
  return {
    id,
    classification: "fact",
    category: "dependencies",
    subject: {
      type: "dependency",
      name: "legacy-tool",
    },
    title: "Declared dependency",
    description: "A dependency declaration was observed.",
    rule: {
      id: ruleId,
      version: "1",
    },
    requirementIds: ["FR-017"],
    evidenceIds: [projectEvidence.id],
    factIds: [factId],
    limitationIds: [],
  };
}

export function createPriority(
  ruleId = "PRIORITY-001",
  level: FindingPriority["level"] = "low",
): FindingPriority {
  return {
    level,
    rule: {
      id: ruleId,
      version: "1",
    },
    rationale: "Fixture priority.",
    factors: [
      {
        key: "fixture",
        rationale: "Fixture priority factor.",
        evidenceIds: [projectEvidence.id],
      },
    ],
  };
}

export function createRecommendation(
  ruleId: string,
  id: string,
  findingId: string,
): Recommendation {
  return {
    id,
    basis: "fact",
    title: "Review dependency",
    suggestion: "Review the dependency declaration.",
    why: "A dependency-related finding exists.",
    impact: "Keeps the dependency list intentional.",
    rule: {
      id: ruleId,
      version: "1",
    },
    requirementIds: ["FR-015"],
    findingIds: [findingId],
    evidenceIds: [projectEvidence.id],
  };
}

export function createLimitation(ruleId: string, id: string): AnalysisLimitation {
  return {
    id,
    kind: "insufficient_evidence",
    message: "The fixture intentionally lacks some evidence.",
    affectedCategories: ["security"],
    sourceIds: [],
    ruleIds: [ruleId],
  };
}

export function createScores(findingId?: string): AnalysisScores {
  const contributions = findingId
    ? [
        {
          id: "score-dependency-finding",
          category: "dependencies" as const,
          direction: "deduction" as const,
          points: 5,
          rationale: "Fixture deduction.",
          rule: {
            id: "SCORE-DEP-001",
            version: "1",
          },
          findingIds: [findingId],
          factIds: [],
          evidenceIds: [projectEvidence.id],
        },
      ]
    : [];

  const contributionIds = contributions.map((contribution) => contribution.id);

  return {
    overall: {
      status: "available",
      value: findingId ? 95 : 100,
      evidenceCoverage: 100,
      contributionIds,
    },
    categories: {
      dependencies: {
        status: "available",
        value: findingId ? 95 : 100,
        evidenceCoverage: 100,
        contributionIds,
      },
      security: {
        status: "available",
        value: 100,
        evidenceCoverage: 100,
        contributionIds: [],
      },
      maintainability: {
        status: "available",
        value: 100,
        evidenceCoverage: 100,
        contributionIds: [],
      },
      testing: {
        status: "available",
        value: 100,
        evidenceCoverage: 100,
        contributionIds: [],
      },
      tooling: {
        status: "available",
        value: 100,
        evidenceCoverage: 100,
        contributionIds: [],
      },
    },
    contributions,
  };
}
