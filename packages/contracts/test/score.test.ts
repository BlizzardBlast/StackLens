import { describe, expect, it } from "vitest";

import {
  InsufficientEvidenceScoreSchema,
  ScoreContributionSchema,
  ScoreResultSchema,
} from "../src/score.js";

describe("score contracts", () => {
  it("represents insufficient evidence explicitly instead of as zero", () => {
    expect(
      InsufficientEvidenceScoreSchema.safeParse({
        status: "insufficient_evidence",
        evidenceCoverage: 0,
        limitationIds: ["limitation-testing"],
      }).success,
    ).toBe(true);

    expect(
      ScoreResultSchema.safeParse({
        status: "insufficient_evidence",
        value: 0,
        evidenceCoverage: 0,
        limitationIds: ["limitation-testing"],
      }).success,
    ).toBe(false);
  });

  it("requires score contributions to reference a finding or fact", () => {
    const result = ScoreContributionSchema.safeParse({
      id: "contribution-001",
      category: "dependencies",
      direction: "deduction",
      points: 5,
      rationale: "Example contribution.",
      rule: {
        id: "SCORE-DEP-001",
        version: "1",
      },
      findingIds: [],
      factIds: [],
      evidenceIds: ["evidence-001"],
    });

    expect(result.success).toBe(false);
  });
});
