import * as z from "zod";

import { ScoreCategorySchema } from "./category.js";
import { IdentifierSchema, RuleReferenceSchema } from "./identifiers.js";
import { IsoDateTimeSchema } from "./time.js";

export const AnalysisLimitationKindSchema = z.enum([
  "input_mode",
  "unsupported_configuration",
  "external_data",
  "insufficient_evidence",
  "resource_limit",
  "partial_failure",
]);

export const AnalysisLimitationSchema = z.strictObject({
  id: IdentifierSchema,
  kind: AnalysisLimitationKindSchema,
  message: z.string().trim().min(1).max(4000),
  affectedCategories: z.array(ScoreCategorySchema).default([]),
  sourceIds: z.array(IdentifierSchema).default([]),
  ruleIds: z.array(IdentifierSchema).default([]),
  reasonCode: IdentifierSchema.optional(),
  packagePaths: z.array(z.string().min(1).max(1000)).optional(),
  checkKeys: z.array(IdentifierSchema).optional(),
  paths: z.array(z.string().min(1).max(1000)).optional(),
});

export const LegacyAnalysisLimitationSchema = AnalysisLimitationSchema.omit({
  reasonCode: true,
  packagePaths: true,
  checkKeys: true,
  paths: true,
});

export const SourcePartialFailureSchema = z.strictObject({
  id: IdentifierSchema,
  scope: z.literal("source"),
  sourceId: IdentifierSchema,
  code: IdentifierSchema,
  message: z.string().trim().min(1).max(4000),
  retryable: z.boolean(),
  occurredAt: IsoDateTimeSchema,
});

export const RulePartialFailureSchema = z.strictObject({
  id: IdentifierSchema,
  scope: z.literal("rule"),
  rule: RuleReferenceSchema,
  code: IdentifierSchema,
  message: z.string().trim().min(1).max(4000),
  retryable: z.boolean(),
  occurredAt: IsoDateTimeSchema,
});

export const AcquisitionPartialFailureSchema = z.strictObject({
  id: IdentifierSchema,
  scope: z.literal("acquisition"),
  code: IdentifierSchema,
  message: z.string().trim().min(1).max(4000),
  retryable: z.boolean(),
  occurredAt: IsoDateTimeSchema,
});

export const PartialFailureSchema = z.discriminatedUnion("scope", [
  SourcePartialFailureSchema,
  RulePartialFailureSchema,
  AcquisitionPartialFailureSchema,
]);

export type AnalysisLimitationKind = z.infer<typeof AnalysisLimitationKindSchema>;
export type AnalysisLimitation = z.infer<typeof AnalysisLimitationSchema>;
export type PartialFailure = z.infer<typeof PartialFailureSchema>;
