import {
  analyzePublicGitHubRepository,
  type RepositoryAnalysisDependencies,
  type RepositoryAnalysisResult,
} from "@stacklens/analysis-orchestration";
import {
  isTerminalAnalysisStatus,
  type AnalysisFailureSummary,
  type AnalysisRepository,
} from "@stacklens/persistence";
import {
  durableStageForProgress,
  parseRepositoryAnalysisJobPayload,
  REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
} from "@stacklens/repository-jobs";
import type { Task } from "graphile-worker";

export type RepositoryAnalyzer = (
  command: Parameters<typeof analyzePublicGitHubRepository>[0],
  dependencies: RepositoryAnalysisDependencies,
) => Promise<RepositoryAnalysisResult>;

export interface RepositoryAnalysisTaskDependencies {
  readonly repository: AnalysisRepository;
  readonly analysisDependencies: Omit<RepositoryAnalysisDependencies, "onProgress">;
  readonly analyze?: RepositoryAnalyzer;
  readonly now?: () => string;
}

function failureSummary(
  code: string,
  message: string,
  retryable: boolean,
): AnalysisFailureSummary {
  return { code, message, retryable };
}

export function createRepositoryAnalysisTask(
  dependencies: RepositoryAnalysisTaskDependencies,
): Task {
  const analyze = dependencies.analyze ?? analyzePublicGitHubRepository;
  const now = dependencies.now ?? (() => new Date().toISOString());

  return async (rawPayload) => {
    const payload = parseRepositoryAnalysisJobPayload(rawPayload);
    const existing = await dependencies.repository.findAnalysis(payload.analysisId);

    if (existing === undefined) {
      throw new Error("Repository analysis record does not exist.");
    }

    if (existing.repositoryUrl !== payload.repositoryUrl || existing.requestedRef !== payload.ref) {
      const completedAt = now();
      await dependencies.repository.fail({
        id: existing.id,
        failureSummary: failureSummary(
          "job_input_mismatch",
          "Repository analysis job input does not match its persisted analysis.",
          false,
        ),
        updatedAt: completedAt,
        completedAt,
      });
      return;
    }

    if (isTerminalAnalysisStatus(existing.status)) {
      return;
    }

    const startedAt = now();
    await dependencies.repository.markRunning(existing.id, existing.startedAt ?? startedAt);

    let result: RepositoryAnalysisResult;

    try {
      result = await analyze(
        {
          analysisId: existing.id,
          createdAt: existing.createdAt,
          repositoryUrl: existing.repositoryUrl,
          ...(existing.requestedRef === undefined ? {} : { ref: existing.requestedRef }),
        },
        {
          ...dependencies.analysisDependencies,
          async onProgress(progress) {
            const stage = durableStageForProgress(progress);

            if (stage !== undefined) {
              await dependencies.repository.updateProgress(existing.id, stage, now());
            }
          },
        },
      );
    } catch {
      const updatedAt = now();
      await dependencies.repository.markRetryPending({
        id: existing.id,
        failureSummary: failureSummary(
          "repository_analysis_unexpected_failure",
          "Repository analysis failed unexpectedly and may be retried.",
          true,
        ),
        updatedAt,
      });
      throw new Error("Repository analysis failed unexpectedly.");
    }

    if (!result.ok) {
      const summary = failureSummary(result.error.code, result.error.message, result.error.retryable);
      const updatedAt = now();

      if (result.error.retryable) {
        await dependencies.repository.markRetryPending({
          id: existing.id,
          failureSummary: summary,
          updatedAt,
        });
        throw new Error("Repository analysis provider failure is retryable.");
      }

      await dependencies.repository.fail({
        id: existing.id,
        failureSummary: summary,
        updatedAt,
        completedAt: updatedAt,
      });
      return;
    }

    await dependencies.repository.updateProgress(existing.id, "scoring", now());

    const completedAt = now();
    const completedWithLimitations =
      result.report.limitations.length > 0 || result.report.partialFailures.length > 0;

    await dependencies.repository.complete({
      id: existing.id,
      report: result.report,
      completedAt,
      status: completedWithLimitations ? "completed_with_limitations" : "completed",
    });
  };
}

export function createRepositoryAnalysisTaskList(
  dependencies: RepositoryAnalysisTaskDependencies,
): Record<string, Task> {
  return {
    [REPOSITORY_ANALYSIS_TASK_IDENTIFIER]: createRepositoryAnalysisTask(dependencies),
  };
}
