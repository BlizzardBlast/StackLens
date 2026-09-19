import * as z from "zod";

import {
  IdentifierSchema,
  RequirementIdSchema,
  RuleReferenceSchema
} from "./identifiers.js";
import { HeuristicConfidenceSchema } from "./finding.js";

const RecommendationBaseShape = {
  id: IdentifierSchema,
  title: z.string().trim().min(1).max(500),
  suggestion: z.string().trim().min(1).max(4000),
  why: z.string().trim().min(1).max(4000),
  impact: z.string().trim().min(1).max(4000),
  rule: RuleReferenceSchema,
  requirementIds: z.array(RequirementIdSchema).min(1),
  findingIds: z.array(IdentifierSchema).min(1),
  evidenceIds: z.array(IdentifierSchema).min(1)
} as const;

export const FactualRecommendationSchema = z.strictObject({
  ...RecommendationBaseShape,
  basis: z.literal("fact")
});

export const HeuristicRecommendationSchema = z.strictObject({
  ...RecommendationBaseShape,
  basis: z.literal("heuristic"),
  confidence: HeuristicConfidenceSchema
});

export const RecommendationSchema = z.discriminatedUnion("basis", [
  FactualRecommendationSchema,
  HeuristicRecommendationSchema
]);

export type FactualRecommendation = z.infer<typeof FactualRecommendationSchema>;
export type HeuristicRecommendation = z.infer<typeof HeuristicRecommendationSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
