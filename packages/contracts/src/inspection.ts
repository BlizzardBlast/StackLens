import * as z from "zod";

import { ScoreCategorySchema } from "./category.js";
import { IdentifierSchema } from "./identifiers.js";

export const CheckStateSchema = z.enum(["pass", "fail", "unknown", "not_applicable"]);
export const RiskBandSchema = z.enum(["none", "low", "medium", "high", "critical"]);
export const WorkspacePackageSchema = z.strictObject({
  id: IdentifierSchema,
  path: z.string().min(1).max(1000),
  name: z.string().min(1).max(500).optional(),
  manifestPath: z.string().min(1).max(1000),
  role: z.enum(["package", "orchestrator"]),
});
export const InspectionCheckDetailsSchema = z
  .strictObject({
    kind: z.literal("inspection_check"),
    key: IdentifierSchema,
    packagePath: z.string().min(1).max(1000),
    category: ScoreCategorySchema,
    state: CheckStateSchema,
    observedSeverity: RiskBandSchema.optional(),
    packageName: z.string().min(1).max(500).optional(),
    limitationIds: z.array(IdentifierSchema).default([]),
  })
  .superRefine((check, ctx) => {
    if (check.state === "unknown" && check.limitationIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["limitationIds"],
        message: "Unknown checks require a limitation reference",
      });
    }
    if (
      check.category === "security" &&
      check.state === "fail" &&
      check.observedSeverity === undefined
    )
      ctx.addIssue({
        code: "custom",
        path: ["observedSeverity"],
        message: "A confirmed security check requires supported severity",
      });
  });
export const WorkspacePackageDetailsSchema = z.strictObject({
  kind: z.literal("workspace_package"),
  package: WorkspacePackageSchema,
});
export const ConfigurationInspectionDetailsSchema = z.strictObject({
  kind: z.literal("configuration_inspection"),
  unresolvedFields: z.array(z.string().min(1).max(1000)).max(256),
  provenancePaths: z.array(z.string().min(1).max(1000)).max(128),
  configuredPlugins: z.array(z.string().min(1).max(500)).max(128),
  affectedChecks: z.array(IdentifierSchema),
});
export const DependencyResolutionDetailsSchema = z.strictObject({
  kind: z.literal("dependency_resolution"),
  packagePath: z.string().min(1).max(1000),
  dependencyGroup: IdentifierSchema,
  declaredSpecifier: z.string().min(1).max(2000),
  effectiveSpecifier: z.string().min(1).max(2000),
  version: z.string().min(1).max(500).optional(),
  internalPackagePath: z.string().min(1).max(1000).optional(),
  lockfilePath: z.string().min(1).max(1000).optional(),
  catalog: z.string().min(1).max(500).optional(),
});
export const AdvisoryDetailsSchema = z.strictObject({
  kind: z.literal("advisory"),
  advisoryId: IdentifierSchema,
  aliases: z.array(IdentifierSchema),
  packageName: z.string().min(1).max(500),
  version: z.string().min(1).max(500),
  severity: z.enum(["none", "low", "medium", "high", "critical", "unknown"]),
  ratings: z.array(
    z.strictObject({
      vector: z.string().min(1).max(1000),
      version: z.enum(["2.0", "3.0", "3.1", "4.0"]),
      source: z.string().min(1).max(500),
      baseScore: z.number().min(0).max(10),
    }),
  ),
});

export type InspectionCheckDetails = z.infer<typeof InspectionCheckDetailsSchema>;
export type WorkspacePackage = z.infer<typeof WorkspacePackageSchema>;
export type RiskBand = z.infer<typeof RiskBandSchema>;
export type AdvisoryDetails = z.infer<typeof AdvisoryDetailsSchema>;
