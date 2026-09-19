import { describe, expect, it } from "vitest";

import {
  FactualFindingSchema,
  HeuristicFindingSchema,
  FindingSchema
} from "../src/finding.js";

import { createValidAnalysisReport } from "./fixture.js";

describe("finding contracts", () => {
  it("keeps factual findings free of heuristic confidence", () => {
    const finding = createValidAnalysisReport().findings[0]!;
    const result = FactualFindingSchema.safeParse({
      ...finding,
      confidence: {
        level: "high",
        rationale: "Should not be accepted on a factual finding.",
        factIds: ["fact-dependency-deprecated"]
      }
    });

    expect(result.success).toBe(false);
  });

  it("requires heuristic confidence and supporting fact ids", () => {
    const finding = createValidAnalysisReport().findings[0]!;
    const heuristic = {
      ...finding,
      classification: "heuristic",
      confidence: {
        level: "high",
        rationale: "Multiple deterministic maintenance signals agree.",
        factIds: ["fact-dependency-deprecated"]
      }
    } as const;

    expect(HeuristicFindingSchema.safeParse(heuristic).success).toBe(true);

    const { confidence: _confidence, ...withoutConfidence } = heuristic;
    expect(FindingSchema.safeParse(withoutConfidence).success).toBe(false);
  });
});
