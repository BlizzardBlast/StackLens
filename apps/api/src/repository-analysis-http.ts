import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as z from "zod";

import { AnalysisReportSchema, IsoDateTimeSchema } from "@stacklens/contracts";
import {
  ANALYSIS_PROGRESS_STAGES,
  ANALYSIS_STATUSES,
  type AnalysisFailureSummary,
} from "@stacklens/persistence";

import {
  readRepositoryAnalysis,
  submitRepositoryAnalysis,
  type RepositoryAnalysisApplicationDependencies,
  type RepositoryAnalysisSnapshot,
} from "./repository-analysis.js";

const RepositoryAnalysisRequestSchema = z
  .strictObject({
    repositoryUrl: z.string(),
  })
  .describe("Public GitHub repository analysis request.");

const RepositoryAnalysisAcceptedSchema = z.strictObject({
  analysisId: z.string(),
});

const AnalysisFailureSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

const RepositoryAnalysisStatusSchema = z.strictObject({
  analysisId: z.string(),
  repositoryUrl: z.string(),
  status: z.enum(ANALYSIS_STATUSES),
  progressStage: z.enum(ANALYSIS_PROGRESS_STAGES),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  startedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
  failure: AnalysisFailureSchema.optional(),
  report: AnalysisReportSchema.optional(),
});

const AnalysisIdParamsSchema = z.strictObject({
  analysisId: z.string().min(1),
});

export const ApiErrorSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
});

export interface RepositoryAnalysisHttpDependencies
  extends RepositoryAnalysisApplicationDependencies {}

function publicFailure(
  failureSummary: AnalysisFailureSummary | undefined,
): AnalysisFailureSummary | undefined {
  return failureSummary === undefined
    ? undefined
    : {
        code: failureSummary.code,
        message: failureSummary.message,
        retryable: failureSummary.retryable,
      };
}

function statusResponse(snapshot: RepositoryAnalysisSnapshot) {
  const { analysis, report } = snapshot;
  const failure =
    analysis.status === "failed" ? publicFailure(analysis.failureSummary) : undefined;

  return {
    analysisId: analysis.id,
    repositoryUrl: analysis.repositoryUrl,
    status: analysis.status,
    progressStage: analysis.progressStage,
    createdAt: analysis.createdAt,
    updatedAt: analysis.updatedAt,
    ...(analysis.startedAt === undefined ? {} : { startedAt: analysis.startedAt }),
    ...(analysis.completedAt === undefined ? {} : { completedAt: analysis.completedAt }),
    ...(failure === undefined ? {} : { failure }),
    ...(report === undefined ? {} : { report: report.report }),
  };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function registerRepositoryAnalysisRoutes(
  app: FastifyInstance,
  dependencies: RepositoryAnalysisHttpDependencies,
): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.post(
    "/v1/analyses/repository",
    {
      schema: {
        operationId: "createRepositoryAnalysis",
        tags: ["analysis"],
        summary: "Create an asynchronous public GitHub repository analysis",
        body: RepositoryAnalysisRequestSchema,
        response: {
          202: RepositoryAnalysisAcceptedSchema,
          400: ApiErrorSchema,
          503: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await submitRepositoryAnalysis(request.body, dependencies);

        if (!result.ok) {
          return reply.code(400).send({
            code: result.error.code,
            message: result.error.message,
          });
        }

        return reply.code(202).send({
          analysisId: result.analysis.id,
        });
      } catch (error) {
        request.log.error(
          { errorName: errorName(error) },
          "Repository analysis submission dependency failed.",
        );

        return reply.code(503).send({
          code: "analysis_unavailable",
          message: "Repository analysis is temporarily unavailable.",
        });
      }
    },
  );

  api.get(
    "/v1/analyses/:analysisId",
    {
      schema: {
        operationId: "getRepositoryAnalysis",
        tags: ["analysis"],
        summary: "Read durable repository analysis status or terminal result",
        params: AnalysisIdParamsSchema,
        response: {
          200: RepositoryAnalysisStatusSchema,
          400: ApiErrorSchema,
          404: ApiErrorSchema,
          503: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const snapshot = await readRepositoryAnalysis(
          request.params.analysisId,
          dependencies.repository,
        );

        if (snapshot === undefined) {
          return reply.code(404).send({
            code: "analysis_not_found",
            message: "Analysis was not found.",
          });
        }

        if (
          (snapshot.analysis.status === "completed" ||
            snapshot.analysis.status === "completed_with_limitations") &&
          snapshot.report === undefined
        ) {
          request.log.error(
            { analysisId: snapshot.analysis.id },
            "Completed repository analysis is missing its durable report.",
          );

          return reply.code(503).send({
            code: "analysis_unavailable",
            message: "Repository analysis is temporarily unavailable.",
          });
        }

        return reply.code(200).send(statusResponse(snapshot));
      } catch (error) {
        request.log.error(
          { errorName: errorName(error) },
          "Repository analysis status dependency failed.",
        );

        return reply.code(503).send({
          code: "analysis_unavailable",
          message: "Repository analysis is temporarily unavailable.",
        });
      }
    },
  );
}
