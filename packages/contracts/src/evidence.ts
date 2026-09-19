import * as z from "zod";

import { IdentifierSchema } from "./identifiers.js";

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const DataSourceStatusSchema = z.enum(["available", "partial", "unavailable"]);

export const DataSourceSchema = z.strictObject({
  id: IdentifierSchema,
  provider: IdentifierSchema,
  status: DataSourceStatusSchema,
  retrievedAt: IsoDateTimeSchema,
  reference: z.string().trim().min(1).max(1000).optional()
});

export const SourceLocationSchema = z
  .strictObject({
    path: z.string().trim().min(1).max(1000),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional()
  })
  .superRefine((location, ctx) => {
    if (
      location.startLine !== undefined &&
      location.endLine !== undefined &&
      location.endLine < location.startLine
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endLine"],
        message: "endLine must be greater than or equal to startLine"
      });
    }
  });

const EvidenceBaseShape = {
  id: IdentifierSchema,
  summary: z.string().trim().min(1).max(2000)
} as const;

export const ProjectEvidenceSchema = z.strictObject({
  ...EvidenceBaseShape,
  kind: z.literal("project"),
  location: SourceLocationSchema.optional()
});

export const ExternalEvidenceSchema = z.strictObject({
  ...EvidenceBaseShape,
  kind: z.literal("external"),
  sourceId: IdentifierSchema,
  reference: z.string().trim().min(1).max(1000),
  url: z.string().url().optional(),
  publishedAt: IsoDateTimeSchema.optional()
});

export const EvidenceSchema = z.discriminatedUnion("kind", [
  ProjectEvidenceSchema,
  ExternalEvidenceSchema
]);

export type DataSourceStatus = z.infer<typeof DataSourceStatusSchema>;
export type DataSource = z.infer<typeof DataSourceSchema>;
export type ProjectEvidence = z.infer<typeof ProjectEvidenceSchema>;
export type ExternalEvidence = z.infer<typeof ExternalEvidenceSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
