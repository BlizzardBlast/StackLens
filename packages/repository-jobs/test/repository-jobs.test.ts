import { describe, expect, it, vi } from "vitest";

import type {
  AnalysisRepository,
  RepositoryAnalysisRecord,
} from "@stacklens/persistence";

import {
  createGraphileRepositoryJobQueue,
  createRepositoryAnalysisJob,
  durableStageForProgress,
  parseRepositoryAnalysisJobPayload,
  REPOSITORY_ANALYSIS_MAX_ATTEMPTS,
  REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
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

function repository(record = queuedRecord()): AnalysisRepository {
  return {
    createQueuedRepositoryAnalysis: vi.fn(async () => record),
    findAnalysis: vi.fn(async () => record),
    findReport: vi.fn(async () => undefined),
    claimForExecution: vi.fn(async () => true),
    updateProgress: vi.fn(async () => undefined),
    markRetryPending: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
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
    expect(durableStageForProgress({ phase: "analysis", status: "started" })).toBe(
      "running_rules",
    );
    expect(durableStageForProgress({ phase: "analysis", status: "completed" })).toBe("scoring");
  });
});

describe("repository job enqueue service [FR-003, NFR-008, NFR-009]", () => {
  it("persists queued state before enqueueing a minimal job", async () => {
    const analysisRepository = repository();
    const enqueue = vi.fn(async () => undefined);

    const result = await createRepositoryAnalysisJob(
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
        createdAt,
      },
      {
        repository: analysisRepository,
        queue: { enqueue },
      },
    );

    expect(result.status).toBe("queued");
    expect(analysisRepository.createQueuedRepositoryAnalysis).toHaveBeenCalledWith({
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
    const addJob = vi.fn(async () => ({ id: "graphile-job-1" }));
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
