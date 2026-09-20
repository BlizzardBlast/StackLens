import { describe, expect, it, vi } from "vitest";

import type { AnalysisRepository, RepositoryAnalysisRecord } from "@stacklens/persistence";

import {
  createGraphileRepositoryJobQueue,
  createRepositoryAnalysisJob,
  durableStageForProgress,
  parseRepositoryAnalysisJobPayload,
  REPOSITORY_ANALYSIS_MAX_ATTEMPTS,
  REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
  type GraphileJobAdder,
  type RepositoryJobQueue,
} from "../src/index.js";

const createdAt = "2026-09-21T00:00:00.000Z";

function queuedRecord(): RepositoryAnalysisRecord {
  return {
    id: "analysis-001",
    inputType: "repository",
    repositoryUrl: "https://github.com/acme/demo",
    requestedRef: "main",
    status: "queued",
    progressStage: "queued",
    createdAt,
    updatedAt: createdAt,
  };
}

function repositoryHarness(record = queuedRecord()) {
  const createQueuedRepositoryAnalysis = vi.fn<
    AnalysisRepository["createQueuedRepositoryAnalysis"]
  >(async () => record);
  const findAnalysis = vi.fn<AnalysisRepository["findAnalysis"]>(async () => record);
  const findReport = vi.fn<AnalysisRepository["findReport"]>(async () => undefined);
  const claimForExecution = vi.fn<AnalysisRepository["claimForExecution"]>(async () => true);
  const updateProgress = vi.fn<AnalysisRepository["updateProgress"]>(async () => undefined);
  const markRetryPending = vi.fn<AnalysisRepository["markRetryPending"]>(async () => undefined);
  const complete = vi.fn<AnalysisRepository["complete"]>(async () => undefined);
  const fail = vi.fn<AnalysisRepository["fail"]>(async () => undefined);

  const repository: AnalysisRepository = {
    createQueuedRepositoryAnalysis,
    findAnalysis,
    findReport,
    claimForExecution,
    updateProgress,
    markRetryPending,
    complete,
    fail,
  };

  return {
    repository,
    createQueuedRepositoryAnalysis,
  };
}

describe("repository analysis job payload [SEC-003, NFR-008]", () => {
  it("accepts only the minimal source-free payload", () => {
    expect(
      parseRepositoryAnalysisJobPayload({
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      }),
    ).toEqual({
      analysisId: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      ref: "main",
    });

    expect(() =>
      parseRepositoryAnalysisJobPayload({
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        sourceContent: "never-persist",
      }),
    ).toThrow("unsupported field");
  });
});

describe("durable repository progress [FR-003, FR-021, NFR-008]", () => {
  it("maps transient orchestration events to coarse persisted stages", () => {
    expect(durableStageForProgress({ phase: "repository", status: "started" })).toBe(
      "resolving_repository",
    );
    expect(durableStageForProgress({ phase: "repository", status: "completed" })).toBe(
      "collecting_snapshot",
    );
    expect(durableStageForProgress({ phase: "manifest", status: "completed" })).toBe(
      "collecting_snapshot",
    );
    expect(
      durableStageForProgress({
        phase: "package_metadata",
        status: "progress",
        completed: 1,
        total: 2,
        failed: 0,
      }),
    ).toBe("collecting_metadata");
    expect(durableStageForProgress({ phase: "analysis", status: "started" })).toBe("running_rules");
    expect(durableStageForProgress({ phase: "analysis", status: "completed" })).toBe("scoring");
  });
});

describe("repository job enqueue service [FR-003, NFR-008, NFR-009]", () => {
  it("persists queued state before enqueueing a minimal job", async () => {
    const harness = repositoryHarness();
    const enqueue = vi.fn<RepositoryJobQueue["enqueue"]>(async () => undefined);

    const result = await createRepositoryAnalysisJob(
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
        createdAt,
      },
      {
        repository: harness.repository,
        queue: { enqueue },
      },
    );

    expect(result.status).toBe("queued");
    expect(harness.createQueuedRepositoryAnalysis).toHaveBeenCalledWith({
      id: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      requestedRef: "main",
      createdAt,
    });
    expect(enqueue).toHaveBeenCalledWith({
      analysisId: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      ref: "main",
    });
  });

  it("configures Graphile with a stable analysis job key and bounded attempts", async () => {
    const addJob = vi.fn<GraphileJobAdder["addJob"]>(async () => ({
      id: "graphile-job-1",
    }));
    const queue = createGraphileRepositoryJobQueue({ addJob });

    await queue.enqueue({
      analysisId: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
    });

    expect(addJob).toHaveBeenCalledWith(
      REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
      },
      {
        jobKey: "repository-analysis:analysis-001",
        maxAttempts: REPOSITORY_ANALYSIS_MAX_ATTEMPTS,
      },
    );
  });
});
