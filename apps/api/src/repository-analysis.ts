import { randomUUID } from "node:crypto";

import { parsePublicGitHubRepositoryUrl } from "@stacklens/data-sources";
import type {
  AnalysisRepository,
  RepositoryAnalysisRecord,
  StoredAnalysisReport,
} from "@stacklens/persistence";
import {
  createRepositoryAnalysisJob,
  type RepositoryAnalysisDeliveryDispatcher,
} from "@stacklens/repository-jobs";

export interface SubmitRepositoryAnalysisCommand {
  readonly repositoryUrl: string;
}

export interface RepositoryAnalysisApplicationDependencies {
  readonly repository: AnalysisRepository;
  readonly deliveryDispatcher: RepositoryAnalysisDeliveryDispatcher;
  readonly createAnalysisId?: () => string;
  readonly now?: () => string;
  readonly retentionHours?: number;
}

export interface RepositoryAnalysisValidationError {
  readonly code: "invalid_repository_url";
  readonly message: string;
  readonly requirementIds: readonly ["FR-003", "FR-004"];
}

export type SubmitRepositoryAnalysisResult =
  | {
      readonly ok: true;
      readonly analysis: RepositoryAnalysisRecord;
    }
  | {
      readonly ok: false;
      readonly error: RepositoryAnalysisValidationError;
    };

export interface RepositoryAnalysisSnapshot {
  readonly analysis: RepositoryAnalysisRecord;
  readonly report?: StoredAnalysisReport;
}

export async function submitRepositoryAnalysis(
  command: SubmitRepositoryAnalysisCommand,
  dependencies: RepositoryAnalysisApplicationDependencies,
): Promise<SubmitRepositoryAnalysisResult> {
  const repository = parsePublicGitHubRepositoryUrl(command.repositoryUrl);

  if (repository === undefined) {
    return {
      ok: false,
      error: {
        code: "invalid_repository_url",
        message: "repositoryUrl must be a public HTTPS GitHub repository URL.",
        requirementIds: ["FR-003", "FR-004"],
      },
    };
  }

  const analysisId = (dependencies.createAnalysisId ?? randomUUID)();
  const createdAt = (dependencies.now ?? (() => new Date().toISOString()))();
  const retentionHours = dependencies.retentionHours;
  if (
    retentionHours !== undefined &&
    (!Number.isSafeInteger(retentionHours) || retentionHours < 1 || retentionHours > 8_760)
  ) {
    throw new Error("Repository retention hours must be an integer from 1 to 8760.");
  }

  const analysis = await createRepositoryAnalysisJob(
    {
      analysisId,
      repositoryUrl: repository.canonicalUrl,
      createdAt,
      ...(retentionHours === undefined
        ? {}
        : {
            retentionExpiresAt: new Date(
              new Date(createdAt).getTime() + retentionHours * 3_600_000,
            ).toISOString(),
          }),
    },
    {
      repository: dependencies.repository,
      deliveryDispatcher: dependencies.deliveryDispatcher,
    },
  );

  return {
    ok: true,
    analysis,
  };
}

export async function readRepositoryAnalysis(
  analysisId: string,
  repository: AnalysisRepository,
): Promise<RepositoryAnalysisSnapshot | undefined> {
  const analysis = await repository.findAnalysis(analysisId);

  if (analysis === undefined) {
    return undefined;
  }

  if (analysis.status !== "completed" && analysis.status !== "completed_with_limitations") {
    return { analysis };
  }

  const report = await repository.findReport(analysis.id);

  if (report !== undefined) {
    return { analysis, report };
  }

  // Retention may remove the analysis between reads. Recheck once so only a missing row
  // becomes not found; a surviving completed row without its report remains unavailable.
  const refreshedAnalysis = await repository.findAnalysis(analysisId);
  return refreshedAnalysis === undefined ? undefined : { analysis: refreshedAnalysis };
}
