import * as z from "zod";

export const IdentifierSchema = z.string().trim().min(1).max(200);

export const RequirementIdSchema = z
  .string()
  .regex(/^(?:PRD|FR|NFR|SEC|DATA|SCORE|GOV)-\d{3}$/);

export const RuleReferenceSchema = z.strictObject({
  id: IdentifierSchema,
  version: IdentifierSchema
});

export type RequirementId = z.infer<typeof RequirementIdSchema>;
export type RuleReference = z.infer<typeof RuleReferenceSchema>;
