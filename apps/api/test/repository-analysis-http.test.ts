import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";
import type {
  AnalysisRepository,
  RepositoryAnalysisRecord,
  StoredAnalysisReport,
} from "@stacklens/persistence";
import type { RepositoryJobQueue } from "@stacklens/repository-jobs";

import { createStackLensApi } from "../src/index.js";

const createdAt = "2026-09-21T12:00:00.000Z";

function record(overrides: Partial<RepositoryAnalysisRecord> = {}): RepositoryAnalysisRecord {
  return {
    id: "analysis-test-001",
    inputType: "repository",
    repositoryUrl: "https://github.com/acme/demo",
    status: "queued",
    progressStage: "queued",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
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

function report(analysisId: string): AnalysisReport {
  return {
    schemaVersion: "1.0.0",
    analysisId,
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
  };
}

function repositoryHarness(
  initialAnalysis?: RepositoryAnalysisRecord,
  initialReport?: StoredAnalysisReport,
) {
  let currentAnalysis = initialAnalysis;
  let currentReport = initialReport;

  const createQueuedRepositoryAnalysis = vi.fn<
    AnalysisRepository["createQueuedRepositoryAnalysis"]
  >(async (input) => {
    currentAnalysis = record({
      id: input.id,
      repositoryUrl: input.repositoryUrl,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      ...(input.requestedRef === undefined ? {} : { requestedRef: input.requestedRef }),
    });

    return currentAnalysis;
  });
  const findAnalysis = vi.fn<AnalysisRepository["findAnalysis"]>(async (id) =>
    currentAnalysis?.id === id ? currentAnalysis : undefined,
  );
  const findReport = vi.fn<AnalysisRepository["findReport"]>(async (analysisId) =>
    currentReport?.analysisId === analysisId ? currentReport : undefined,
  );
  const claimForExecution = vi.fn<AnalysisRepository["claimForExecution"]>(async () => false);
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
    findAnalysis,
    findReport,
    setAnalysis(value: RepositoryAnalysisRecord | undefined) {
      currentAnalysis = value;
    },
    setReport(value: StoredAnalysisReport | undefined) {
      currentReport = value;
    },
  };
}

function queueHarness(error?: Error) {
  const enqueue = vi.fn<RepositoryJobQueue["enqueue"]>(async () => {
    if (error !== undefined) {
      throw error;
    }
  });

  return {
    enqueue,
    queue: { enqueue } satisfies RepositoryJobQueue,
  };
}

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  const apps = openApps.splice(0);
  await Promise.all(apps.map(async (app) => app.close()));
});

async function testApi(
  repository: AnalysisRepository,
  queue: RepositoryJobQueue,
): Promise<FastifyInstance> {
  const app = await createStackLensApi({
    repository,
    queue,
    createAnalysisId: () => "analysis-test-001",
    now: () => createdAt,
  });

  openApps.push(app);
  return app;
}

describe("repository analysis Fastify transport [FR-003, FR-004, NFR-008]", () => {
  it("validates, canonicalizes, persists, and enqueues repository work before returning 202", async () => {
    const persistence = repositoryHarness();
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo.git/",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      analysisId: "analysis-test-001",
    });
    expect(persistence.createQueuedRepositoryAnalysis).toHaveBeenCalledWith({
      id: "analysis-test-001",
      repositoryUrl: "https://github.com/acme/demo",
      createdAt,
    });
    expect(jobs.enqueue).toHaveBeenCalledWith({
      analysisId: "analysis-test-001",
      repositoryUrl: "https://github.com/acme/demo",
    });
  });

  it("rejects unsupported repository URLs and unknown request fields before durable work", async () => {
    const persistence = repositoryHarness();
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const unsupported = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://example.com/acme/demo",
      },
    });
    const extraField = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo",
        source: "must-not-be-accepted",
      },
    });

    expect(unsupported.statusCode).toBe(400);
    expect(unsupported.json()).toEqual({
      code: "invalid_repository_url",
      message: "repositoryUrl must be a public HTTPS GitHub repository URL.",
    });
    expect(extraField.statusCode).toBe(400);
    expect(extraField.json()).toEqual({
      code: "invalid_request",
      message: "Request does not match the API schema.",
    });
    expect(persistence.createQueuedRepositoryAnalysis).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("returns a stable availability error when durable queue submission fails", async () => {
    const persistence = repositoryHarness();
    const jobs = queueHarness(new Error("synthetic queue failure"));
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      code: "analysis_unavailable",
      message: "Repository analysis is temporarily unavailable.",
    });
    expect(response.body).not.toContain("synthetic queue failure");
    expect(response.body).not.toContain("analysis-test-001");
  });

  it("returns durable running progress without exposing queue internals", async () => {
    const persistence = repositoryHarness(
      record({
        status: "running",
        progressStage: "collecting_metadata",
        startedAt: "2026-09-21T12:00:01.000Z",
        updatedAt: "2026-09-21T12:00:02.000Z",
      }),
    );
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/analysis-test-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      analysisId: "analysis-test-001",
      repositoryUrl: "https://github.com/acme/demo",
      status: "running",
      progressStage: "collecting_metadata",
      createdAt,
      startedAt: "2026-09-21T12:00:01.000Z",
      updatedAt: "2026-09-21T12:00:02.000Z",
    });
    expect(persistence.findReport).not.toHaveBeenCalled();
    expect(response.body).not.toContain("job");
  });

  it("returns the contract-valid report for completed repository analysis", async () => {
    const completedAt = "2026-09-21T12:00:05.000Z";
    const analysisReport = report("analysis-test-001");
    const persistence = repositoryHarness(
      record({
        status: "completed",
        progressStage: "completed",
        startedAt: "2026-09-21T12:00:01.000Z",
        completedAt,
        updatedAt: completedAt,
      }),
      {
        analysisId: "analysis-test-001",
        reportSchemaVersion: "1.0.0",
        report: analysisReport,
        createdAt: completedAt,
      },
    );
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/analysis-test-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      analysisId: "analysis-test-001",
      status: "completed",
      progressStage: "completed",
      completedAt,
      report: analysisReport,
    });
    expect(persistence.findReport).toHaveBeenCalledWith("analysis-test-001");
  });

  it("returns typed terminal failure and does not expose a report", async () => {
    const completedAt = "2026-09-21T12:00:05.000Z";
    const persistence = repositoryHarness(
      record({
        status: "failed",
        progressStage: "failed",
        completedAt,
        updatedAt: completedAt,
        failureSummary: {
          code: "repository_not_found",
          message: "The public repository could not be resolved.",
          retryable: false,
        },
      }),
    );
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/analysis-test-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      analysisId: "analysis-test-001",
      status: "failed",
      progressStage: "failed",
      failure: {
        code: "repository_not_found",
        message: "The public repository could not be resolved.",
        retryable: false,
      },
    });
    expect(response.json()).not.toHaveProperty("report");
    expect(persistence.findReport).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown analysis identifier", async () => {
    const persistence = repositoryHarness();
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/missing-analysis",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "analysis_not_found",
      message: "Analysis was not found.",
    });
  });

  it("publishes the repository analysis polling contract through OpenAPI", async () => {
    const persistence = repositoryHarness();
    const jobs = queueHarness();
    const app = await testApi(persistence.repository, jobs.queue);

    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/v1/analyses/repository": {
          post: {
            operationId: "createRepositoryAnalysis",
            responses: {
              "202": {},
              "400": {},
              "503": {},
            },
          },
        },
        "/v1/analyses/{analysisId}": {
          get: {
            operationId: "getRepositoryAnalysis",
            responses: {
              "200": {},
              "400": {},
              "404": {},
              "503": {},
            },
          },
        },
      },
    });
  });
});
