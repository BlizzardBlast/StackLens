import { describe, expect, it, vi } from "vitest";

import type { RepositoryAnalysisResult } from "@stacklens/analysis-orchestration";
import type {
  AnalysisRepository,
  RepositoryAnalysisRecord,
} from "@stacklens/persistence";
import type { JobHelpers, Task } from "graphile-worker";

import {
  createRepositoryAnalysisTask,
  type RepositoryAnalyzer,
  type RepositoryAnalysisTaskDependencies,
} from "../src/index.js";

const createdAt = "2026-09-21T00:00:00.000Z";

function record(
  overrides: Partial<RepositoryAnalysisRecord> = {},
): RepositoryAnalysisRecord {
  return {
    id: "analysis-001",
    inputType: "repository",
    repositoryUrl: "https://github.com/acme/demo",
    requestedRef: "main",
    status: "queued",
    progressStage: "queued",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function repository(
  analysis = record(),
  claimForExecution = true,
): AnalysisRepository {
  return {
    createQueuedRepositoryAnalysis: vi.fn(async () => analysis),
    findAnalysis: vi.fn(async () => analysis),
    findReport: vi.fn(async () => undefined),
    claimForExecution: vi.fn(async () => claimForExecution),
    updateProgress: vi.fn(async () => undefined),
    markRetryPending: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
  };
}

function availableScore() {
  return {
    status: "available" as const,
    value: 100,
    evidenceCoverage: 100,
    contributionIds: [],
  };
}

function successfulResult(): RepositoryAnalysisResult {
  return {
    ok: true,
    report: {
      schemaVersion: "1.0.0",
      analysisId: "analysis-001",
      createdAt,
      input: {
        type: "repository",
        fingerprint: "github:acme/demo@0123456789abcdef0123456789abcdef01234567",
        repository: {
          provider: "github",
          owner: "acme",
          name: "demo",
          commitSha: "0123456789abcdef0123456789abcdef01234567",
          ref: "main",
        },
      },
      analyzer: {
        version: "javascript-production-v1",
        ruleSetVersion: "javascript-rules-v1",
        scoringVersion: "stack-health-v1",
      },
      sources: [],
      evidence: [],
      facts: [],
      findings: [],
      recommendations: [],
      scores: {
        overall: availableScore(),
        categories: {
          dependencies: availableScore(),
          security: availableScore(),
          maintainability: availableScore(),
          testing: availableScore(),
          tooling: availableScore(),
        },
        contributions: [],
      },
      limitations: [],
      partialFailures: [],
    },
    progress: [],
  };
}

function retryableFailure(): RepositoryAnalysisResult {
  return {
    ok: false,
    error: {
      code: "repository_unavailable",
      message: "GitHub repository acquisition failed transiently.",
      retryable: true,
      requirementIds: ["FR-003", "FR-004"],
      providerFailureCode: "github_request_timeout",
    },
    progress: [],
  };
}

function helpers(
  attempts: number,
  maxAttempts: number,
  id = "graphile-job-1",
): JobHelpers {
  return {
    job: {
      id,
      attempts,
      max_attempts: maxAttempts,
    },
  } as unknown as JobHelpers;
}

async function invoke(
  task: Task,
  payload: unknown,
  taskHelpers: JobHelpers,
): Promise<void> {
  await task(payload, taskHelpers);
}

const analysisDependencies =
  {} as RepositoryAnalysisTaskDependencies["analysisDependencies"];

describe("repository analysis worker task [FR-003, FR-021, NFR-003, NFR-008, NFR-009]", () => {
  it("persists ordered coarse progress and completes the owning job", async () => {
    const analysisRepository = repository();
    const analyzeImplementation: RepositoryAnalyzer = async (_command, dependencies) => {
      await dependencies.onProgress?.({ phase: "repository", status: "started" });
      await dependencies.onProgress?.({ phase: "repository", status: "completed" });
      await dependencies.onProgress?.({
        phase: "package_metadata",
        status: "progress",
        completed: 1,
        total: 1,
        failed: 0,
      });
      await dependencies.onProgress?.({ phase: "analysis", status: "started" });
      return successfulResult();
    };
    const analyze = vi.fn(analyzeImplementation);
    const now = vi
      .fn<() => string>()
      .mockReturnValueOnce("2026-09-21T00:00:01.000Z")
      .mockReturnValue("2026-09-21T00:00:02.000Z");

    const task = createRepositoryAnalysisTask({
      repository: analysisRepository,
      analysisDependencies,
      analyze,
      now,
    });

    await invoke(
      task,
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      helpers(1, 5),
    );

    expect(analysisRepository.claimForExecution).toHaveBeenCalledWith(
      "analysis-001",
      "graphile-job-1",
      "2026-09-21T00:00:01.000Z",
    );
    expect(analysisRepository.updateProgress).toHaveBeenNthCalledWith(
      1,
      "analysis-001",
      "graphile-job-1",
      "resolving_repository",
      "2026-09-21T00:00:02.000Z",
    );
    expect(analysisRepository.updateProgress).toHaveBeenCalledWith(
      "analysis-001",
      "graphile-job-1",
      "collecting_metadata",
      "2026-09-21T00:00:02.000Z",
    );
    expect(analysisRepository.updateProgress).toHaveBeenCalledWith(
      "analysis-001",
      "graphile-job-1",
      "running_rules",
      "2026-09-21T00:00:02.000Z",
    );
    expect(analysisRepository.updateProgress).toHaveBeenLastCalledWith(
      "analysis-001",
      "graphile-job-1",
      "scoring",
      "2026-09-21T00:00:02.000Z",
    );
    expect(analysisRepository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "analysis-001",
        jobId: "graphile-job-1",
        status: "completed",
      }),
    );
    expect(analysisRepository.fail).not.toHaveBeenCalled();
  });

  it("does not execute a duplicate Graphile job that cannot claim the analysis", async () => {
    const analysisRepository = repository(record({ status: "running" }), false);
    const analyze = vi.fn<RepositoryAnalyzer>();

    const task = createRepositoryAnalysisTask({
      repository: analysisRepository,
      analysisDependencies,
      analyze,
    });

    await invoke(
      task,
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      helpers(1, 5, "duplicate-job"),
    );

    expect(analyze).not.toHaveBeenCalled();
    expect(analysisRepository.complete).not.toHaveBeenCalled();
    expect(analysisRepository.fail).not.toHaveBeenCalled();
  });

  it("returns retryable failures to Graphile before the final attempt", async () => {
    const analysisRepository = repository();
    const analyze = vi.fn<RepositoryAnalyzer>(async () => retryableFailure());

    const task = createRepositoryAnalysisTask({
      repository: analysisRepository,
      analysisDependencies,
      analyze,
    });

    await expect(
      invoke(
        task,
        {
          analysisId: "analysis-001",
          repositoryUrl: "https://github.com/acme/demo",
          ref: "main",
        },
        helpers(2, 5),
      ),
    ).rejects.toThrow("retryable");

    expect(analysisRepository.markRetryPending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "analysis-001",
        jobId: "graphile-job-1",
      }),
    );
    expect(analysisRepository.fail).not.toHaveBeenCalled();
  });

  it("persists a terminal failure instead of permafailing on the final Graphile attempt", async () => {
    const analysisRepository = repository();
    const analyze = vi.fn<RepositoryAnalyzer>(async () => retryableFailure());

    const task = createRepositoryAnalysisTask({
      repository: analysisRepository,
      analysisDependencies,
      analyze,
    });

    await invoke(
      task,
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      helpers(5, 5),
    );

    expect(analysisRepository.markRetryPending).not.toHaveBeenCalled();
    expect(analysisRepository.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "analysis-001",
        jobId: "graphile-job-1",
        failureSummary: expect.objectContaining({
          code: "repository_unavailable",
          retryable: true,
        }),
      }),
    );
  });

  it("short-circuits already-terminal analyses on at-least-once delivery", async () => {
    const analysisRepository = repository(record({ status: "completed", progressStage: "completed" }));
    const analyze = vi.fn<RepositoryAnalyzer>();

    const task = createRepositoryAnalysisTask({
      repository: analysisRepository,
      analysisDependencies,
      analyze,
    });

    await invoke(
      task,
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      helpers(1, 5),
    );

    expect(analysisRepository.claimForExecution).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });
});
