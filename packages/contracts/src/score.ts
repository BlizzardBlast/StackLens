import * as z from "zod";

import { ScoreCategorySchema } from "./category.js";
import { IdentifierSchema, RuleReferenceSchema } from "./identifiers.js";

export const ScoreContributionDirectionSchema = z.enum(["addition", "deduction"]);

export const ScoreContributionSchema = z
  .strictObject({
    id: IdentifierSchema,
    category: ScoreCategorySchema,
    direction: ScoreContributionDirectionSchema,
    points: z.number().finite().positive(),
    rationale: z.string().trim().min(1).max(4000),
    rule: RuleReferenceSchema,
    findingIds: z.array(IdentifierSchema).default([]),
    factIds: z.array(IdentifierSchema).default([]),
    evidenceIds: z.array(IdentifierSchema).min(1),
  })
  .superRefine((contribution, ctx) => {
    if (contribution.findingIds.length === 0 && contribution.factIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["findingIds"],
        message: "A score contribution must reference at least one finding or fact",
      });
    }
  });

const ScoreBaseShape = {
  evidenceCoverage: z.number().finite().min(0).max(100),
} as const;

export const AvailableScoreSchema = z.strictObject({
  ...ScoreBaseShape,
  status: z.literal("available"),
  value: z.number().finite().min(0).max(100),
  contributionIds: z.array(IdentifierSchema),
});

export const InsufficientEvidenceScoreSchema = z.strictObject({
  ...ScoreBaseShape,
  status: z.literal("insufficient_evidence"),
  limitationIds: z.array(IdentifierSchema).min(1),
});

export const ScoreResultSchema = z.discriminatedUnion("status", [
  AvailableScoreSchema,
  InsufficientEvidenceScoreSchema,
]);

export const CategoryScoresSchema = z.strictObject({
  dependencies: ScoreResultSchema,
  security: ScoreResultSchema,
  maintainability: ScoreResultSchema,
  testing: ScoreResultSchema,
  tooling: ScoreResultSchema,
});

export const AnalysisScoresSchema = z.strictObject({
  overall: ScoreResultSchema,
  categories: CategoryScoresSchema,
  contributions: z.array(ScoreContributionSchema),
});

export type ScoreContributionDirection = z.infer<typeof ScoreContributionDirectionSchema>;
export type ScoreContribution = z.infer<typeof ScoreContributionSchema>;
export type AvailableScore = z.infer<typeof AvailableScoreSchema>;
export type InsufficientEvidenceScore = z.infer<typeof InsufficientEvidenceScoreSchema>;
export type ScoreResult = z.infer<typeof ScoreResultSchema>;
export type CategoryScores = z.infer<typeof CategoryScoresSchema>;
export type AnalysisScores = z.infer<typeof AnalysisScoresSchema>;
