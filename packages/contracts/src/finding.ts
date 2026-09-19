import * as z from "zod";

import { ScoreCategorySchema } from "./category.js";
import { IdentifierSchema, RequirementIdSchema, RuleReferenceSchema } from "./identifiers.js";
import { AnalysisSubjectSchema } from "./subject.js";

export const FindingClassificationSchema = z.enum(["fact", "heuristic"]);
export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"]);
export const PriorityLevelSchema = z.enum(["critical", "high", "medium", "low"]);

export const HeuristicConfidenceSchema = z.strictObject({
  level: ConfidenceLevelSchema,
  rationale: z.string().trim().min(1).max(4000),
  factIds: z.array(IdentifierSchema).min(1)
});

export const PriorityFactorSchema = z.strictObject({
  key: IdentifierSchema,
  rationale: z.string().trim().min(1).max(2000),
  evidenceIds: z.array(IdentifierSchema).default([])
});

export const FindingPrioritySchema = z.strictObject({
  level: PriorityLevelSchema,
  rule: RuleReferenceSchema,
  rationale: z.string().trim().min(1).max(4000),
  factors: z.array(PriorityFactorSchema).min(1)
});

const FindingBaseShape = {
  id: IdentifierSchema,
  category: ScoreCategorySchema,
  subject: AnalysisSubjectSchema,
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(4000),
  rule: RuleReferenceSchema,
  requirementIds: z.array(RequirementIdSchema).min(1),
  evidenceIds: z.array(IdentifierSchema).min(1),
  factIds: z.array(IdentifierSchema).default([]),
  limitationIds: z.array(IdentifierSchema).default([]),
  priority: FindingPrioritySchema
} as const;

export const FactualFindingSchema = z.strictObject({
  ...FindingBaseShape,
  classification: z.literal("fact")
});

export const HeuristicFindingSchema = z.strictObject({
  ...FindingBaseShape,
  classification: z.literal("heuristic"),
  confidence: HeuristicConfidenceSchema
});

export const FindingSchema = z.discriminatedUnion("classification", [
  FactualFindingSchema,
  HeuristicFindingSchema
]);

export type FindingClassification = z.infer<typeof FindingClassificationSchema>;
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;
export type PriorityLevel = z.infer<typeof PriorityLevelSchema>;
export type HeuristicConfidence = z.infer<typeof HeuristicConfidenceSchema>;
export type FindingPriority = z.infer<typeof FindingPrioritySchema>;
export type FactualFinding = z.infer<typeof FactualFindingSchema>;
export type HeuristicFinding = z.infer<typeof HeuristicFindingSchema>;
export type Finding = z.infer<typeof FindingSchema>;
