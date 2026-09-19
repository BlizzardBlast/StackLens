import * as z from "zod";

import { IdentifierSchema, RequirementIdSchema, RuleReferenceSchema } from "./identifiers.js";
import { AnalysisSubjectSchema } from "./subject.js";

export const DependencyInventoryFactDetailsSchema = z.strictObject({
  kind: z.literal("dependency_inventory"),
  dependencyGroup: IdentifierSchema,
  declaredSpecifier: z.string().min(1).max(2000),
});

export const AnalysisFactDetailsSchema = DependencyInventoryFactDetailsSchema;

export const AnalysisFactSchema = z.strictObject({
  id: IdentifierSchema,
  type: IdentifierSchema,
  subject: AnalysisSubjectSchema,
  statement: z.string().trim().min(1).max(4000),
  details: AnalysisFactDetailsSchema.optional(),
  rule: RuleReferenceSchema,
  requirementIds: z.array(RequirementIdSchema).min(1),
  evidenceIds: z.array(IdentifierSchema).min(1),
});

export type DependencyInventoryFactDetails = z.infer<
  typeof DependencyInventoryFactDetailsSchema
>;
export type AnalysisFactDetails = z.infer<typeof AnalysisFactDetailsSchema>;
export type AnalysisFact = z.infer<typeof AnalysisFactSchema>;
