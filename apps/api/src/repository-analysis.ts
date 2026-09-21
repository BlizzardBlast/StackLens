import { randomUUID } from "node:crypto";

import { parsePublicGitHubRepositoryUrl } from "@stacklens/data-sources";
import type {
  AnalysisRepository,
  RepositoryAnalysisRecord,
  StoredAnalysisReport,
} from "@stacklens/persistence";
import { createRepositoryAnalysisJob, type RepositoryJobQueue } from "@stacklens/repository-jobs";

export interface SubmitRepositoryAnalysisCommand {
  readonly repositoryUrl: string;
}

export interface RepositoryAnalysisApplicationDependencies {
  readonly repository: AnalysisRepository;
  readonly queue: RepositoryJobQueue;
  readonly createAnalysisId?: () => string;
  readonly now?: () => string;
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

  const analysis = await createRepositoryAnalysisJob(
    {
      analysisId,
      repositoryUrl: repository.canonicalUrl,
      createdAt,
    },
    {
      repository: dependencies.repository,
      queue: dependencies.queue,
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

  return report === undefined ? { analysis } : { analysis, report };
}
