import * as z from "zod";

import { ScoreCategorySchema } from "./category.js";
import { IdentifierSchema, RuleReferenceSchema } from "./identifiers.js";
import { RiskBandSchema } from "./inspection.js";

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

export const LegacyAnalysisScoresSchema = z.strictObject({
  overall: ScoreResultSchema,
  categories: CategoryScoresSchema,
  contributions: z.array(ScoreContributionSchema),
});

const CheckCountsSchema = z.strictObject({
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
});
const ScoreV2Base = {
  scope: z.string().min(1).max(2000),
  rationale: z.string().min(1).max(4000),
  checkCounts: CheckCountsSchema,
  checkFactIds: z.array(IdentifierSchema),
};
export const AvailableScoreV2Schema = z.strictObject({
  ...ScoreV2Base,
  checkCounts: CheckCountsSchema.extend({ unknown: z.literal(0) }),
  status: z.literal("available"),
  value: z.number().finite().min(0).max(100),
  contributionIds: z.array(IdentifierSchema),
  band: RiskBandSchema.optional(),
  affectedPackageCount: z.number().int().nonnegative().optional(),
  affectedAdvisoryCount: z.number().int().nonnegative().optional(),
});
export const InsufficientEvidenceScoreV2Schema = z.strictObject({
  ...ScoreV2Base,
  status: z.literal("insufficient_evidence"),
  limitationIds: z.array(IdentifierSchema).min(1),
});
export const NotApplicableScoreSchema = z.strictObject({
  ...ScoreV2Base,
  status: z.literal("not_applicable"),
});
export const ScoreResultV2Schema = z.discriminatedUnion("status", [
  AvailableScoreV2Schema,
  InsufficientEvidenceScoreV2Schema,
  NotApplicableScoreSchema,
]);
export const ScoreExplanationSchema = ScoreContributionSchema.safeExtend({
  kind: z.enum(["risk_band", "readiness_check", "overall_ceiling"]),
  points: z.number().finite().min(0).max(100),
});
export const AnalysisScoresV2Schema = z.strictObject({
  overall: ScoreResultV2Schema,
  categories: z.strictObject({
    dependencies: ScoreResultV2Schema,
    security: ScoreResultV2Schema,
    maintainability: ScoreResultV2Schema,
    testing: ScoreResultV2Schema,
    tooling: ScoreResultV2Schema,
  }),
  contributions: z.array(ScoreExplanationSchema),
});
export const AnalysisScoresSchema = z.union([LegacyAnalysisScoresSchema, AnalysisScoresV2Schema]);
export type AnalysisScoresV2 = z.infer<typeof AnalysisScoresV2Schema>;
export type ScoreResultV2 = z.infer<typeof ScoreResultV2Schema>;
export type ScoreExplanation = z.infer<typeof ScoreExplanationSchema>;

export type ScoreContributionDirection = z.infer<typeof ScoreContributionDirectionSchema>;
export type ScoreContribution = z.infer<typeof ScoreContributionSchema>;
export type AvailableScore = z.infer<typeof AvailableScoreSchema>;
export type InsufficientEvidenceScore = z.infer<typeof InsufficientEvidenceScoreSchema>;
export type ScoreResult = z.infer<typeof ScoreResultSchema>;
export type CategoryScores = z.infer<typeof CategoryScoresSchema>;
export type AnalysisScores = z.infer<typeof AnalysisScoresSchema>;
