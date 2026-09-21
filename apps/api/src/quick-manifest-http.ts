import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as z from "zod";

import type { AnalyzerDefinition } from "@stacklens/analyzer-core";
import { AnalysisReportSchema } from "@stacklens/contracts";
import type { NormalizedPackageManifest } from "@stacklens/rules-javascript";

import { ApiErrorSchema } from "./repository-analysis-http.js";
import {
  analyzeQuickManifest,
  type QuickManifestInput,
  type QuickManifestValidationErrorCode,
} from "./quick-manifest-analysis.js";
import { quickManifestAnalyzer } from "./quick-manifest-analyzer.js";

const MAX_MANIFEST_CONTENT_LENGTH = 1_048_576;

export const QuickManifestAnalysisRequestSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("paste"),
      content: z.string().max(MAX_MANIFEST_CONTENT_LENGTH),
    }),
    z.strictObject({
      kind: z.literal("upload"),
      filename: z.string().min(1).max(255),
      content: z.string().max(MAX_MANIFEST_CONTENT_LENGTH),
    }),
  ])
  .describe("Synchronous package.json quick-analysis request.");

export const QuickManifestAnalysisResponseSchema = z.strictObject({
  report: AnalysisReportSchema,
});

export interface QuickManifestAnalysisHttpDependencies {
  readonly quickManifestAnalyzer?: AnalyzerDefinition<NormalizedPackageManifest, unknown>;
  readonly createAnalysisId?: () => string;
  readonly now?: () => string;
}

function errorStatus(code: QuickManifestValidationErrorCode): 400 {
  return 400;
}

function publicInput(input: z.infer<typeof QuickManifestAnalysisRequestSchema>): QuickManifestInput {
  return input.kind === "paste"
    ? {
        kind: "paste",
        content: input.content,
      }
    : {
        kind: "upload",
        filename: input.filename,
        content: input.content,
      };
}

export function registerQuickManifestAnalysisRoutes(
  app: FastifyInstance,
  dependencies: QuickManifestAnalysisHttpDependencies,
): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/analyze/manifest",
    {
      schema: {
        operationId: "analyzeManifest",
        tags: ["analysis"],
        summary: "Analyze package.json content synchronously",
        body: QuickManifestAnalysisRequestSchema,
        response: {
          200: QuickManifestAnalysisResponseSchema,
          400: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = analyzeQuickManifest(
        {
          analysisId: (dependencies.createAnalysisId ?? randomUUID)(),
          createdAt: (dependencies.now ?? (() => new Date().toISOString()))(),
          input: publicInput(request.body),
        },
        {
          analyzer: dependencies.quickManifestAnalyzer ?? quickManifestAnalyzer,
        },
      );

      if (!result.ok) {
        return reply.code(errorStatus(result.error.code)).send({
          code: result.error.code,
          message: result.error.message,
        });
      }

      return reply.code(200).send({
        report: result.report,
      });
    },
  );
}
