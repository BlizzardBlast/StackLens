import type { AnalysisRepository, RepositoryAnalysisRecord } from "@stacklens/persistence";

import {
  REPOSITORY_ANALYSIS_MAX_ATTEMPTS,
  REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
  type RepositoryAnalysisJobPayload,
} from "./job.js";

export interface RepositoryJobQueue {
  enqueue(payload: RepositoryAnalysisJobPayload): Promise<void>;
}

export interface CreateRepositoryAnalysisJobCommand {
  readonly analysisId: string;
  readonly repositoryUrl: string;
  readonly ref?: string;
  readonly createdAt: string;
  readonly retentionExpiresAt?: string;
}

export interface CreateRepositoryAnalysisJobDependencies {
  readonly repository: AnalysisRepository;
  readonly queue: RepositoryJobQueue;
}

export async function createRepositoryAnalysisJob(
  command: CreateRepositoryAnalysisJobCommand,
  dependencies: CreateRepositoryAnalysisJobDependencies,
): Promise<RepositoryAnalysisRecord> {
  const record = await dependencies.repository.createQueuedRepositoryAnalysis({
    id: command.analysisId,
    repositoryUrl: command.repositoryUrl,
    ...(command.ref === undefined ? {} : { requestedRef: command.ref }),
    createdAt: command.createdAt,
    ...(command.retentionExpiresAt === undefined
      ? {}
      : { retentionExpiresAt: command.retentionExpiresAt }),
  });

  await dependencies.queue.enqueue({
    analysisId: record.id,
    repositoryUrl: record.repositoryUrl,
    ...(record.requestedRef === undefined ? {} : { ref: record.requestedRef }),
  });

  return record;
}

export interface GraphileJobAdder {
  addJob(
    identifier: string,
    payload: Record<string, unknown>,
    options?: {
      readonly jobKey?: string;
      readonly jobKeyMode?: "unsafe_dedupe";
      readonly maxAttempts?: number;
    },
  ): Promise<unknown>;
}

export function createGraphileRepositoryJobQueue(jobAdder: GraphileJobAdder): RepositoryJobQueue {
  return {
    async enqueue(payload) {
      await jobAdder.addJob(
        REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
        { ...payload },
        {
          jobKey: "repository-analysis:" + payload.analysisId,
          jobKeyMode: "unsafe_dedupe",
          maxAttempts: REPOSITORY_ANALYSIS_MAX_ATTEMPTS,
        },
      );
    },
  };
}
