import * as z from "zod";

export const IdentifierSchema = z.string().trim().min(1).max(200);

export const RequirementIdSchema = z
  .string()
  .regex(/^(?:PRD|FR|NFR|SEC|DATA|SCORE|GOV)-\d{3}$/);

export const RuleReferenceSchema = z.strictObject({
  id: IdentifierSchema,
  version: IdentifierSchema
});

export const AnalysisSubjectSchema = z.strictObject({
  type: IdentifierSchema,
  name: z.string().trim().min(1).max(500),
  path: z.string().trim().min(1).max(1000).optional()
});

export type RequirementId = z.infer<typeof RequirementIdSchema>;
export type RuleReference = z.infer<typeof RuleReferenceSchema>;
export type AnalysisSubject = z.infer<typeof AnalysisSubjectSchema>;
