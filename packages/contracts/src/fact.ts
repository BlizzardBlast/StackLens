import * as z from "zod";

import { IdentifierSchema, RequirementIdSchema, RuleReferenceSchema } from "./identifiers.js";
import { AnalysisSubjectSchema } from "./subject.js";

export const AnalysisFactSchema = z.strictObject({
  id: IdentifierSchema,
  type: IdentifierSchema,
  subject: AnalysisSubjectSchema,
  statement: z.string().trim().min(1).max(4000),
  rule: RuleReferenceSchema,
  requirementIds: z.array(RequirementIdSchema).min(1),
  evidenceIds: z.array(IdentifierSchema).min(1),
});

export type AnalysisFact = z.infer<typeof AnalysisFactSchema>;
