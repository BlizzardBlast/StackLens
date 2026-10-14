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
import { GitHubConnectionError } from "@stacklens/github-auth";
import type { AnalysisRepository, RepositoryAnalysisRecord } from "@stacklens/persistence";

import {
  executeRepositoryAnalysisJob,
  type RepositoryAnalyzer,
  type RepositoryAnalysisTaskDependencies,
} from "../src/index.js";
import { createWorkerAnalysisDependencies } from "../src/providers.js";

const createdAt = "2026-09-21T00:00:00.000Z";

describe("connected Worker ownership [FR-100, SEC-005, SEC-007]", () => {
  it.each([401, 403, 404, "ended"])(
    "makes real adapter access denial terminal without public fallback (%s)",
    async (denial) => {
      const h = repositoryHarness(
        record({ ownerGithubId: "123", githubConnectionId: "ab".repeat(32) }),
      );
      const fetchImpl = vi.fn<typeof fetch>(
        async () =>
          new Response("sensitive provider detail", {
            status: typeof denial === "number" ? denial : 200,
          }),
      );
      const connected = createWorkerAnalysisDependencies(
        new AbortController().signal,
        undefined,
        fetchImpl,
        {
          repositoryUrl: "https://github.com/acme/demo",
          async getToken() {
            if (denial === "ended") throw new GitHubConnectionError();
            return "synthetic-connected-token";
          },
        },
      );
      const publicFactory = vi.fn<
        NonNullable<RepositoryAnalysisTaskDependencies["createAnalysisDependencies"]>
      >(() => analysisDependencies);
      await executeRepositoryAnalysisJob(
        { analysisId: "analysis-001", repositoryUrl: "https://github.com/acme/demo", ref: "main" },
        { id: "owned-job", attempts: 1, maxAttempts: 5 },
        {
          repository: h.repository,
          analysisDependencies,
          createAnalysisDependencies: publicFactory,
          createConnectedAnalysisDependencies: () => connected,
        },
      );
      expect(fetchImpl).toHaveBeenCalledTimes(denial === "ended" ? 0 : 1);
      expect(publicFactory).not.toHaveBeenCalled();
      expect(h.mocks.markRetryPending).not.toHaveBeenCalled();
      expect(h.mocks.complete).not.toHaveBeenCalled();
      expect(h.mocks.fail).toHaveBeenCalledWith(
        expect.objectContaining({
          failureSummary: {
            code: "github_connection_unavailable",
            message: "Reconnect GitHub and submit a new analysis with repository access.",
            retryable: false,
          },
        }),
      );
    },
  );
  it("retries transient credential-store failures without contacting GitHub [NFR-008]", async () => {
    const h = repositoryHarness(
      record({ ownerGithubId: "123", githubConnectionId: "ab".repeat(32) }),
    );
    const fetchImpl = vi.fn<typeof fetch>();
    const connected = createWorkerAnalysisDependencies(
      new AbortController().signal,
      undefined,
      fetchImpl,
      {
        repositoryUrl: "https://github.com/acme/demo",
        async getToken() {
          throw new Error("sensitive database detail");
        },
      },
    );
    await expect(
      executeRepositoryAnalysisJob(
        { analysisId: "analysis-001", repositoryUrl: "https://github.com/acme/demo", ref: "main" },
        { id: "owned-job", attempts: 1, maxAttempts: 5 },
        {
          repository: h.repository,
          analysisDependencies,
          createConnectedAnalysisDependencies: () => connected,
        },
      ),
    ).rejects.toThrow("retryable");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(h.mocks.fail).not.toHaveBeenCalled();
    expect(h.mocks.markRetryPending).toHaveBeenCalledWith(
      expect.objectContaining({
        failureSummary: expect.objectContaining({
          code: "repository_unavailable",
          message: "Connected GitHub credential lookup is temporarily unavailable.",
          retryable: true,
        }),
      }),
    );
    expect(JSON.stringify(h.mocks.markRetryPending.mock.calls)).not.toContain(
      "sensitive database detail",
    );
  });
  it.each([false, true])(
    "never falls back to public credentials for missing/revoked access (factory=%s)",
    async (factory) => {
      const h = repositoryHarness(
        record({ ownerGithubId: "123", githubConnectionId: "ab".repeat(32) }),
      );
      const analyze = vi.fn<RepositoryAnalyzer>();
      const publicFactory = vi.fn<
        NonNullable<RepositoryAnalysisTaskDependencies["createAnalysisDependencies"]>
      >(() => analysisDependencies);
      await executeRepositoryAnalysisJob(
        { analysisId: "analysis-001", repositoryUrl: "https://github.com/acme/demo", ref: "main" },
        { id: "owned-job", attempts: 1, maxAttempts: 5 },
        {
          repository: h.repository,
          analysisDependencies,
          createAnalysisDependencies: publicFactory,
          analyze,
          ...(factory
            ? {
                createConnectedAnalysisDependencies() {
                  throw new GitHubConnectionError();
                },
              }
            : {}),
        },
      );
      expect(analyze).not.toHaveBeenCalled();
      expect(publicFactory).not.toHaveBeenCalled();
      expect(h.mocks.markRetryPending).not.toHaveBeenCalled();
      expect(h.mocks.fail).toHaveBeenCalledWith(
        expect.objectContaining({
          failureSummary: expect.objectContaining({
            code: "github_connection_unavailable",
            retryable: false,
          }),
        }),
      );
    },
  );
  it("routes connected work through the per-record provider and preserves normal report policy", async () => {
    const h = repositoryHarness(
      record({ ownerGithubId: "123", githubConnectionId: "ab".repeat(32) }),
    );
    const createConnectedAnalysisDependencies = vi.fn<
      NonNullable<RepositoryAnalysisTaskDependencies["createConnectedAnalysisDependencies"]>
    >(() => analysisDependencies);
    const analyze = vi.fn<RepositoryAnalyzer>(async () => successfulResult());
    await executeRepositoryAnalysisJob(
      { analysisId: "analysis-001", repositoryUrl: "https://github.com/acme/demo", ref: "main" },
      { id: "owned-job", attempts: 1, maxAttempts: 5 },
      {
        repository: h.repository,
        analysisDependencies,
        createConnectedAnalysisDependencies,
        analyze,
      },
    );
    expect(createConnectedAnalysisDependencies).toHaveBeenCalledWith(
      expect.objectContaining({ ownerGithubId: "123" }),
      expect.any(AbortSignal),
    );
    expect(h.mocks.complete).toHaveBeenCalledOnce();
  });
});

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
  const createQueuedRepositoryAnalysisWithDelivery = vi.fn<
    AnalysisRepository["createQueuedRepositoryAnalysisWithDelivery"]
  >(async () => analysis);
  const claimPendingRepositoryAnalysisDeliveries = vi.fn<
    AnalysisRepository["claimPendingRepositoryAnalysisDeliveries"]
  >(async () => []);
  const markRepositoryAnalysisDeliveryDelivered = vi.fn<
    AnalysisRepository["markRepositoryAnalysisDeliveryDelivered"]
  >(async () => undefined);
  const retryRepositoryAnalysisDelivery = vi.fn<
    AnalysisRepository["retryRepositoryAnalysisDelivery"]
  >(async () => undefined);
  const findAnalysis = vi.fn<AnalysisRepository["findAnalysis"]>(async () => analysis);
  const findReport = vi.fn<AnalysisRepository["findReport"]>(async () => undefined);
  const claimForExecution = vi.fn<AnalysisRepository["claimForExecution"]>(async () => claimResult);
  const updateProgress = vi.fn<AnalysisRepository["updateProgress"]>(async () => undefined);
  const markRetryPending = vi.fn<AnalysisRepository["markRetryPending"]>(async () => undefined);
  const complete = vi.fn<AnalysisRepository["complete"]>(async () => undefined);
  const fail = vi.fn<AnalysisRepository["fail"]>(async () => undefined);

  const repository: AnalysisRepository = {
    createQueuedRepositoryAnalysis,
    createQueuedRepositoryAnalysisWithDelivery,
    claimPendingRepositoryAnalysisDeliveries,
    markRepositoryAnalysisDeliveryDelivered,
    retryRepositoryAnalysisDelivery,
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

  it.each([1, 5])("preserves interruption semantics at attempt %s [NFR-008]", async (attempts) => {
    const harness = repositoryHarness();
    const controller = new AbortController();
    const analyze = vi.fn<RepositoryAnalyzer>(async (_command, dependencies) => {
      await dependencies.onProgress?.({ phase: "repository", status: "started" });
      controller.abort();
      // Even a provider that resolves after cancellation cannot publish a partial report.
      return successfulResult();
    });
    const execution = executeRepositoryAnalysisJob(
      { analysisId: "analysis-001", repositoryUrl: "https://github.com/acme/demo", ref: "main" },
      { id: "graphile-job-1", attempts, maxAttempts: 5, abortSignal: controller.signal },
      { repository: harness.repository, analysisDependencies, analyze },
    );
    const outcome = await execution.then(
      () => "finished",
      () => "retry",
    );
    expect(outcome).toBe(attempts === 5 ? "finished" : "retry");
    const written = attempts === 5 ? harness.mocks.fail : harness.mocks.markRetryPending;
    const unwritten = attempts === 5 ? harness.mocks.markRetryPending : harness.mocks.fail;
    expect(written).toHaveBeenCalledWith(
      expect.objectContaining({
        failureSummary: expect.objectContaining({ code: "repository_analysis_interrupted" }),
      }),
    );
    expect(unwritten).not.toHaveBeenCalled();
    expect(harness.mocks.complete).not.toHaveBeenCalled();
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
