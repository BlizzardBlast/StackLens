import * as z from "zod";

import { IdentifierSchema } from "./identifiers.js";

export const AnalysisSubjectSchema = z.strictObject({
  type: IdentifierSchema,
  name: z.string().trim().min(1).max(500),
  path: z.string().trim().min(1).max(1000).optional()
});

export type AnalysisSubject = z.infer<typeof AnalysisSubjectSchema>;
