import * as z from "zod";

import { IdentifierSchema } from "./identifiers.js";

const InputBaseShape = {
  fingerprint: z.string().trim().min(1).max(500),
} as const;

export const ManifestAnalysisInputSchema = z.strictObject({
  ...InputBaseShape,
  type: z.literal("manifest"),
});

export const RepositoryIdentitySchema = z.strictObject({
  provider: z.literal("github"),
  owner: IdentifierSchema,
  name: IdentifierSchema,
  commitSha: z.string().regex(/^[0-9a-f]{40}$/i),
  ref: z.string().trim().min(1).max(500).optional(),
});

export const RepositoryAnalysisInputSchema = z.strictObject({
  ...InputBaseShape,
  type: z.literal("repository"),
  repository: RepositoryIdentitySchema,
});

export const AnalysisInputSchema = z.discriminatedUnion("type", [
  ManifestAnalysisInputSchema,
  RepositoryAnalysisInputSchema,
]);

export type ManifestAnalysisInput = z.infer<typeof ManifestAnalysisInputSchema>;
export type RepositoryIdentity = z.infer<typeof RepositoryIdentitySchema>;
export type RepositoryAnalysisInput = z.infer<typeof RepositoryAnalysisInputSchema>;
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
