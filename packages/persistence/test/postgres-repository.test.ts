import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";

import {
  analyses,
  analysisReports,
  createStackLensDatabase,
  DrizzleAnalysisRepository,
  migrateStackLensDatabase,
} from "../src/index.js";
import { analysisDeliveries } from "../src/schema.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const describeWithDatabase = databaseUrl.length > 0 ? describe : describe.skip;
const testSchema = "stacklens_persistence_test";

function availableScore() {
  return {
    status: "available" as const,
    value: 100,
    evidenceCoverage: 100,
    contributionIds: [],
  };
}

function report(): AnalysisReport {
  return {
    schemaVersion: "1.0.0",
    analysisId: "analysis-001",
    createdAt: "2026-09-21T00:00:00.000Z",
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

describeWithDatabase("PostgreSQL analysis persistence [FR-003, FR-021, DATA-006, NFR-008]", () => {
  const adminPool = new Pool({ connectionString: databaseUrl });
  const pool = new Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${testSchema}`,
  });
  const database = createStackLensDatabase(pool);
  const repository = new DrizzleAnalysisRepository(database);

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS ${testSchema}`);
    await migrateStackLensDatabase(database);
  });

  beforeEach(async () => {
    await database.delete(analysisReports);
    await database.delete(analyses);
  });

  it("SEC-003 purges expired terminal reports and delivery rows while preserving active, future and legacy records", async () => {
    const createdAt = "2026-09-21T00:00:00.000Z";
    const ids = ["expired", "failed", "limited", "queued", "running", "future", "legacy"];
    await database.insert(analyses).values(
      ids.map((id) => ({
        id,
        inputType: "repository" as const,
        repositoryUrl: "https://github.com/acme/demo",
        createdAt,
        updatedAt: createdAt,
        status:
          id === "queued"
            ? ("queued" as const)
            : id === "running"
              ? ("running" as const)
              : id === "failed"
                ? ("failed" as const)
                : id === "limited"
                  ? ("completed_with_limitations" as const)
                  : ("completed" as const),
        progressStage:
          id === "queued"
            ? ("queued" as const)
            : id === "running"
              ? ("running_rules" as const)
              : id === "failed"
                ? ("failed" as const)
                : id === "limited"
                  ? ("completed_with_limitations" as const)
                  : ("completed" as const),
        activeJobId: id === "running" ? "job-running" : null,
        retentionExpiresAt:
          id === "legacy"
            ? null
            : id === "future"
              ? "2026-10-02T00:00:00.000Z"
              : "2026-10-01T00:00:00.000Z",
      })),
    );
    await database.insert(analysisDeliveries).values(
      ids.map((id) => ({
        analysisId: id,
        status: "delivered" as const,
        attempts: 1,
        availableAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        deliveredAt: createdAt,
      })),
    );
    await database.insert(analysisReports).values(
      ["expired", "limited", "future", "legacy"].map((id) => ({
        analysisId: id,
        reportSchemaVersion: "1.0.0",
        report: { ...report(), analysisId: id },
        createdAt,
      })),
    );
    expect(await repository.purgeExpiredTerminalAnalyses("2026-09-30T23:59:59.999Z")).toBe(0);
    const now = "2026-10-01T00:00:00.000Z";
    const counts = await Promise.all([
      repository.purgeExpiredTerminalAnalyses(now, 1),
      repository.purgeExpiredTerminalAnalyses(now, 1),
    ]);
    expect(counts).toEqual([1, 1]);
    expect(await repository.purgeExpiredTerminalAnalyses(now, 1)).toBe(1);
    const remaining = await database.select().from(analyses);
    expect(remaining.map((row) => row.id).toSorted()).toEqual([
      "future",
      "legacy",
      "queued",
      "running",
    ]);
    expect(remaining.find((row) => row.id === "running")).toMatchObject({
      status: "running",
      activeJobId: "job-running",
    });
    const remainingReports = await database.select().from(analysisReports);
    expect(remainingReports.map((row) => row.analysisId).toSorted()).toEqual(["future", "legacy"]);
    const deliveries = await database.select().from(analysisDeliveries);
    expect(deliveries.map((row) => row.analysisId).toSorted()).toEqual([
      "future",
      "legacy",
      "queued",
      "running",
    ]);
    await repository.fail({
      id: "running",
      jobId: "job-running",
      completedAt: now,
      updatedAt: now,
      failureSummary: {
        code: "synthetic_failure",
        message: "Synthetic failure.",
        retryable: false,
      },
    });
    expect(await repository.purgeExpiredTerminalAnalyses(now)).toBe(1);
    await expect(repository.purgeExpiredTerminalAnalyses(now, 0)).rejects.toThrow("batch limit");
  });

  afterAll(async () => {
    await pool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE`);
    await adminPool.end();
  });

  it.each(["1.0.0", "2.0.0"] as const)(
    "round trips schema %s without changing its stored policy or scores",
    async (schemaVersion) => {
      const legacy = report();
      const score = {
        status: "not_applicable" as const,
        scope: "Synthetic empty scope",
        rationale: "No applicable checks in this fixture.",
        checkCounts: { passed: 0, failed: 0, unknown: 0, notApplicable: 0 },
        checkFactIds: [],
      };
      const payload: AnalysisReport =
        schemaVersion === "1.0.0"
          ? legacy
          : {
              ...legacy,
              schemaVersion,
              analyzer: {
                version: "javascript-production-v4",
                ruleSetVersion: "javascript-rules-v4",
                scoringVersion: "stack-health-v3",
              },
              scores: {
                overall: score,
                categories: {
                  dependencies: score,
                  security: score,
                  maintainability: score,
                  testing: score,
                  tooling: score,
                },
                contributions: [],
              },
            };
      await repository.createQueuedRepositoryAnalysis({
        id: payload.analysisId,
        repositoryUrl: "https://github.com/acme/demo",
        createdAt: payload.createdAt,
      });
      await repository.claimForExecution(payload.analysisId, "roundtrip-job", payload.createdAt);
      await repository.complete({
        id: payload.analysisId,
        jobId: "roundtrip-job",
        report: payload,
        completedAt: payload.createdAt,
        status: "completed",
      });
      const stored = await repository.findReport(payload.analysisId);
      expect(stored?.reportSchemaVersion).toBe(schemaVersion);
      expect(stored?.report).toEqual(payload);
    },
  );

  it("persists idempotent queued input and enforces execution ownership", async () => {
    const queued = await repository.createQueuedRepositoryAnalysis({
      id: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      requestedRef: "main",
      createdAt: "2026-09-21T00:00:00.000Z",
      retentionExpiresAt: "2026-09-22T00:00:00.000Z",
    });

    expect(queued).toMatchObject({
      id: "analysis-001",
      status: "queued",
      progressStage: "queued",
      createdAt: "2026-09-21T00:00:00.000Z",
      retentionExpiresAt: "2026-09-22T00:00:00.000Z",
    });

    await expect(
      repository.createQueuedRepositoryAnalysis({
        id: "analysis-001",
        repositoryUrl: "https://github.com/acme/demo",
        requestedRef: "main",
        createdAt: "2026-09-21T00:00:00.000Z",
      }),
    ).resolves.toMatchObject({ id: "analysis-001" });

    await expect(
      repository.createQueuedRepositoryAnalysis({
        id: "analysis-001",
        repositoryUrl: "https://github.com/acme/other",
        requestedRef: "main",
        createdAt: "2026-09-21T00:00:00.000Z",
      }),
    ).rejects.toThrow("different repository input");

    await expect(
      repository.claimForExecution("analysis-001", "graphile-job-1", "2026-09-21T00:00:01.000Z"),
    ).resolves.toBe(true);

    await expect(
      repository.claimForExecution("analysis-001", "graphile-job-2", "2026-09-21T00:00:02.000Z"),
    ).resolves.toBe(false);

    await repository.updateProgress(
      "analysis-001",
      "graphile-job-2",
      "collecting_metadata",
      "2026-09-21T00:00:02.000Z",
    );
    expect(await repository.findAnalysis("analysis-001")).toMatchObject({
      status: "running",
      progressStage: "queued",
    });

    await repository.updateProgress(
      "analysis-001",
      "graphile-job-1",
      "collecting_metadata",
      "2026-09-21T00:00:03.000Z",
    );
    expect(await repository.findAnalysis("analysis-001")).toMatchObject({
      status: "running",
      progressStage: "collecting_metadata",
      updatedAt: "2026-09-21T00:00:03.000Z",
    });
  });

  it("atomically persists queued submission with one durable, idempotent delivery", async () => {
    await repository.createQueuedRepositoryAnalysisWithDelivery({
      id: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      requestedRef: "main",
      createdAt: "2026-09-21T00:00:00.000Z",
    });

    const [firstClaim, secondClaim] = await Promise.all([
      repository.claimPendingRepositoryAnalysisDeliveries(
        25,
        "lease-first",
        "2026-09-21T00:00:00.000Z",
        "2026-09-21T00:01:00.000Z",
      ),
      repository.claimPendingRepositoryAnalysisDeliveries(
        25,
        "lease-second",
        "2026-09-21T00:00:00.000Z",
        "2026-09-21T00:01:00.000Z",
      ),
    ]);

    expect([...firstClaim, ...secondClaim]).toHaveLength(1);
    expect([...firstClaim, ...secondClaim][0]).toMatchObject({
      analysisId: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      requestedRef: "main",
      attempts: 1,
    });

    const claimed = firstClaim[0] ?? secondClaim[0];
    expect(claimed).toBeDefined();
    await repository.markRepositoryAnalysisDeliveryDelivered(
      "analysis-001",
      claimed?.leaseToken ?? "unreachable",
      "2026-09-21T00:00:01.000Z",
    );

    await expect(
      repository.claimPendingRepositoryAnalysisDeliveries(
        25,
        "lease-after-delivery",
        "2026-09-21T01:00:00.000Z",
        "2026-09-21T01:01:00.000Z",
      ),
    ).resolves.toEqual([]);
  });

  it("backfills legacy queued analyses and recovers retry and expired leases", async () => {
    await repository.createQueuedRepositoryAnalysis({
      id: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      createdAt: "2026-09-21T00:00:00.000Z",
    });

    const [initialClaim] = await repository.claimPendingRepositoryAnalysisDeliveries(
      25,
      "lease-original",
      "2026-09-21T00:00:00.000Z",
      "2026-09-21T00:01:00.000Z",
    );
    expect(initialClaim).toMatchObject({ attempts: 1, leaseToken: "lease-original" });

    await repository.retryRepositoryAnalysisDelivery(
      "analysis-001",
      "lease-original",
      "2026-09-21T00:00:02.000Z",
      "2026-09-21T00:00:01.000Z",
    );
    await expect(
      repository.claimPendingRepositoryAnalysisDeliveries(
        25,
        "lease-too-early",
        "2026-09-21T00:00:01.000Z",
        "2026-09-21T00:01:01.000Z",
      ),
    ).resolves.toEqual([]);

    const [retriedClaim] = await repository.claimPendingRepositoryAnalysisDeliveries(
      25,
      "lease-retry",
      "2026-09-21T00:00:02.000Z",
      "2026-09-21T00:01:02.000Z",
    );
    expect(retriedClaim).toMatchObject({ attempts: 2, leaseToken: "lease-retry" });

    const [recoveredClaim] = await repository.claimPendingRepositoryAnalysisDeliveries(
      25,
      "lease-recovered",
      "2026-09-21T00:01:03.000Z",
      "2026-09-21T00:02:03.000Z",
    );
    expect(recoveredClaim).toMatchObject({ attempts: 3, leaseToken: "lease-recovered" });
  });

  it("persists retries and only lets the current job complete the analysis", async () => {
    await repository.createQueuedRepositoryAnalysis({
      id: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      requestedRef: "main",
      createdAt: "2026-09-21T00:00:00.000Z",
    });

    await repository.claimForExecution(
      "analysis-001",
      "graphile-job-1",
      "2026-09-21T00:00:01.000Z",
    );
    await repository.markRetryPending({
      id: "analysis-001",
      jobId: "graphile-job-1",
      failureSummary: {
        code: "github_request_timeout",
        message: "GitHub request timed out.",
        retryable: true,
      },
      updatedAt: "2026-09-21T00:00:02.000Z",
    });

    expect(await repository.findAnalysis("analysis-001")).toMatchObject({
      status: "queued",
      progressStage: "queued",
      failureSummary: {
        code: "github_request_timeout",
        retryable: true,
      },
    });

    await repository.claimForExecution(
      "analysis-001",
      "graphile-job-2",
      "2026-09-21T00:00:03.000Z",
    );

    await repository.complete({
      id: "analysis-001",
      jobId: "stale-job",
      report: report(),
      completedAt: "2026-09-21T00:00:04.000Z",
      status: "completed",
    });
    expect(await repository.findReport("analysis-001")).toBeUndefined();

    await repository.complete({
      id: "analysis-001",
      jobId: "graphile-job-2",
      report: report(),
      completedAt: "2026-09-21T00:00:05.000Z",
      status: "completed",
    });

    expect(await repository.findAnalysis("analysis-001")).toMatchObject({
      status: "completed",
      progressStage: "completed",
      repositoryOwner: "acme",
      repositoryName: "demo",
      commitSha: "0123456789abcdef0123456789abcdef01234567",
      inputFingerprint: "github:acme/demo@0123456789abcdef0123456789abcdef01234567",
      analyzerVersion: "javascript-production-v1",
      ruleSetVersion: "javascript-rules-v1",
      scoringVersion: "stack-health-v1",
      completedAt: "2026-09-21T00:00:05.000Z",
    });
    expect(await repository.findReport("analysis-001")).toMatchObject({
      analysisId: "analysis-001",
      reportSchemaVersion: "1.0.0",
      createdAt: "2026-09-21T00:00:05.000Z",
    });
    await expect(
      repository.claimForExecution("analysis-001", "graphile-job-3", "2026-09-21T00:00:06.000Z"),
    ).resolves.toBe(false);
  });

  it("prevents a stale duplicate job from failing an active owner", async () => {
    await repository.createQueuedRepositoryAnalysis({
      id: "analysis-001",
      repositoryUrl: "https://github.com/acme/demo",
      createdAt: "2026-09-21T00:00:00.000Z",
    });
    await repository.claimForExecution(
      "analysis-001",
      "graphile-job-1",
      "2026-09-21T00:00:01.000Z",
    );

    await repository.fail({
      id: "analysis-001",
      jobId: "graphile-job-2",
      failureSummary: {
        code: "duplicate_failure",
        message: "A stale duplicate failed.",
        retryable: false,
      },
      updatedAt: "2026-09-21T00:00:02.000Z",
      completedAt: "2026-09-21T00:00:02.000Z",
    });
    expect(await repository.findAnalysis("analysis-001")).toMatchObject({
      status: "running",
    });

    await repository.fail({
      id: "analysis-001",
      jobId: "graphile-job-1",
      failureSummary: {
        code: "repository_unavailable",
        message: "Repository is unavailable.",
        retryable: false,
      },
      updatedAt: "2026-09-21T00:00:03.000Z",
      completedAt: "2026-09-21T00:00:03.000Z",
    });
    expect(await repository.findAnalysis("analysis-001")).toMatchObject({
      status: "failed",
      progressStage: "failed",
      completedAt: "2026-09-21T00:00:03.000Z",
    });
  });
});
