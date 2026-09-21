import { describe, expect, it, vi } from "vitest";

import type { RepositoryAnalysisResult } from "@stacklens/analysis-orchestration";
import type {
  EvidenceProvider,
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
  NpmPackageMetadata,
  NpmPackageMetadataRequest,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
  ProviderResult,
} from "@stacklens/data-sources";
import type { AnalysisRepository, RepositoryAnalysisRecord } from "@stacklens/persistence";

import {
  executeRepositoryAnalysisJob,
  type RepositoryAnalyzer,
  type RepositoryAnalysisTaskDependencies,
} from "../src/index.js";

const createdAt = "2026-09-21T00:00:00.000Z";

function record(overrides: Partial<RepositoryAnalysisRecord> = {}): RepositoryAnalysisRecord {
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

function repositoryHarness(analysis = record(), claimResult = true) {
  const createQueuedRepositoryAnalysis = vi.fn<
    AnalysisRepository["createQueuedRepositoryAnalysis"]
  >(async () => analysis);
  const findAnalysis = vi.fn<AnalysisRepository["findAnalysis"]>(async () => analysis);
  const findReport = vi.fn<AnalysisRepository["findReport"]>(async () => undefined);
  const claimForExecution = vi.fn<AnalysisRepository["claimForExecution"]>(async () => claimResult);
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
    mocks: {
      claimForExecution,
      updateProgress,
      markRetryPending,
      complete,
      fail,
    },
  };
}

function unusedProvider<TRequest, TData>(id: string): EvidenceProvider<TRequest, TData> {
  return {
    id,
    async fetch(_request: TRequest): Promise<ProviderResult<TData>> {
      throw new Error("Unexpected provider call in worker task test.");
    },
  };
}

const analysisDependencies = {
  githubRepositoryProvider: unusedProvider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
    "github-rest",
  ),
  npmRegistryProvider: unusedProvider<NpmPackageMetadataRequest, NpmPackageMetadata>(
    "npm-registry",
  ),
  osvProvider: unusedProvider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>("osv"),
} satisfies RepositoryAnalysisTaskDependencies["analysisDependencies"];

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

describe("repository analysis worker task [FR-003, FR-021, NFR-003, NFR-008, NFR-009]", () => {
  it("persists ordered coarse progress and completes the owning job", async () => {
    const harness = repositoryHarness();
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
    const analyze = vi.fn<RepositoryAnalyzer>(analyzeImplementation);
    const now = vi
      .fn<() => string>()
      .mockReturnValueOnce("2026-09-21T00:00:01.000Z")
      .mockReturnValue("2026-09-21T00:00:02.000Z");

    await executeRepositoryAnalysisJob(
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      { id: "graphile-job-1", attempts: 1, maxAttempts: 5 },
      {
        repository: harness.repository,
        analysisDependencies,
        analyze,
        now,
      },
    );

    expect(harness.mocks.claimForExecution).toHaveBeenCalledWith(
      "analysis-001",
      "graphile-job-1",
      "2026-09-21T00:00:01.000Z",
    );
    expect(harness.mocks.updateProgress).toHaveBeenNthCalledWith(
      1,
      "analysis-001",
      "graphile-job-1",
      "resolving_repository",
      "2026-09-21T00:00:02.000Z",
    );
    expect(harness.mocks.updateProgress).toHaveBeenCalledWith(
      "analysis-001",
      "graphile-job-1",
      "collecting_metadata",
      "2026-09-21T00:00:02.000Z",
    );
    expect(harness.mocks.updateProgress).toHaveBeenCalledWith(
      "analysis-001",
      "graphile-job-1",
      "running_rules",
      "2026-09-21T00:00:02.000Z",
    );
    expect(harness.mocks.updateProgress).toHaveBeenLastCalledWith(
      "analysis-001",
      "graphile-job-1",
      "scoring",
      "2026-09-21T00:00:02.000Z",
    );
    expect(harness.mocks.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "analysis-001",
        jobId: "graphile-job-1",
        status: "completed",
      }),
    );
    expect(harness.mocks.fail).not.toHaveBeenCalled();
  });

  it("does not execute a duplicate Graphile job that cannot claim the analysis", async () => {
    const harness = repositoryHarness(record({ status: "running" }), false);
    const analyze = vi.fn<RepositoryAnalyzer>();

    await executeRepositoryAnalysisJob(
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      { id: "duplicate-job", attempts: 1, maxAttempts: 5 },
      {
        repository: harness.repository,
        analysisDependencies,
        analyze,
      },
    );

    expect(analyze).not.toHaveBeenCalled();
    expect(harness.mocks.complete).not.toHaveBeenCalled();
    expect(harness.mocks.fail).not.toHaveBeenCalled();
  });

  it("returns retryable failures to Graphile before the final attempt", async () => {
    const harness = repositoryHarness();
    const analyze = vi.fn<RepositoryAnalyzer>(async () => retryableFailure());

    await expect(
      executeRepositoryAnalysisJob(
        {
          analysisId: "analysis-001",
          repositoryUrl: "https://github.com/acme/demo",
          ref: "main",
        },
        { id: "graphile-job-1", attempts: 2, maxAttempts: 5 },
        {
          repository: harness.repository,
          analysisDependencies,
          analyze,
        },
      ),
    ).rejects.toThrow("retryable");

    expect(harness.mocks.markRetryPending).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "analysis-001",
        jobId: "graphile-job-1",
      }),
    );
    expect(harness.mocks.fail).not.toHaveBeenCalled();
  });

  it("persists a terminal failure instead of permafailing on the final Graphile attempt", async () => {
    const harness = repositoryHarness();
    const analyze = vi.fn<RepositoryAnalyzer>(async () => retryableFailure());

    await executeRepositoryAnalysisJob(
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      { id: "graphile-job-1", attempts: 5, maxAttempts: 5 },
      {
        repository: harness.repository,
        analysisDependencies,
        analyze,
      },
    );

    expect(harness.mocks.markRetryPending).not.toHaveBeenCalled();
    expect(harness.mocks.fail).toHaveBeenCalledWith(
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
    const harness = repositoryHarness(record({ status: "completed", progressStage: "completed" }));
    const analyze = vi.fn<RepositoryAnalyzer>();

    await executeRepositoryAnalysisJob(
      {
        analysisId: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        ref: "main",
      },
      { id: "graphile-job-1", attempts: 1, maxAttempts: 5 },
      {
        repository: harness.repository,
        analysisDependencies,
        analyze,
      },
    );

    expect(harness.mocks.claimForExecution).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
  });
});
