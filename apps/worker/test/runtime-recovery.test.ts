import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "@stacklens/persistence";
import { REPOSITORY_ANALYSIS_TASK_IDENTIFIER } from "@stacklens/repository-jobs";

import { recoverConfirmedDeadOwner } from "../src/recovery.js";
import { startStackLensWorker, type StackLensWorkerRuntime } from "../src/runtime.js";
import type { WorkerShutdownProgress } from "../src/shutdown.js";
import { createRepositoryAnalysisTaskList } from "../src/task.js";
import { recoveryProviders } from "./recovery-fixtures.js";

const url = process.env.TEST_DATABASE_URL;
const withDatabase = url ? describe : describe.skip;

withDatabase("Worker interruption and restart [FR-003, FR-021, NFR-008, NFR-009]", () => {
  const databaseName = `stacklens_worker_recovery_${randomUUID().replaceAll("-", "")}`;
  const configuredUrl = url ?? "postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens_test";
  const admin = createStackLensPool(configuredUrl);
  const isolatedUrl = new URL(configuredUrl);
  isolatedUrl.pathname = `/${databaseName}`;
  const connectionString = isolatedUrl.toString();
  const pool = createStackLensPool(connectionString);
  const repository = new DrizzleAnalysisRepository(createStackLensDatabase(pool));
  let runtime: StackLensWorkerRuntime | undefined;
  let shutdownProgress: WorkerShutdownProgress[];

  beforeAll(async () => {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  });
  afterEach(async () => {
    await runtime?.stop();
    runtime = undefined;
  });
  afterAll(async () => {
    await runtime?.stop();
    await pool.end();
    try {
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  });

  function start(interrupt: boolean): Promise<StackLensWorkerRuntime> {
    shutdownProgress = [];
    return startStackLensWorker({
      connectionString,
      concurrency: 1,
      retentionCleanup: false,
      onShutdownProgress: (progress) => shutdownProgress.push(progress),
      taskList: createRepositoryAnalysisTaskList({
        repository,
        analysisDependencies: recoveryProviders(),
        ...(interrupt
          ? { createAnalysisDependencies: (signal: AbortSignal) => recoveryProviders(signal) }
          : {}),
      }),
    });
  }

  async function submit(id: string): Promise<void> {
    await repository.createQueuedRepositoryAnalysis({
      id,
      repositoryUrl: "https://github.com/acme/demo",
      createdAt: new Date().toISOString(),
    });
    await runtime!.runner.addJob(
      REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
      { analysisId: id, repositoryUrl: "https://github.com/acme/demo" },
      { maxAttempts: 5 },
    );
  }

  async function expectReport(id: string): Promise<void> {
    await vi.waitFor(
      async () => expect((await repository.findAnalysis(id))?.status).toMatch(/^completed/u),
      { timeout: 15_000 },
    );
    // findReport uses the persistence boundary's strict shared contract reader.
    expect((await repository.findReport(id))?.report.schemaVersion).toBe("2.0.0");
    await vi.waitFor(
      async () => {
        const locks = await pool.query(
          "SELECT count(*)::int AS count FROM graphile_worker._private_jobs WHERE locked_by IS NOT NULL AND payload->>'analysisId' = $1",
          [id],
        );
        expect(locks.rows[0]?.count).toBe(0);
      },
      { timeout: 5_000 },
    );
  }

  it("retries the same analysis after graceful cancellation, with no stale queue lock", async () => {
    runtime = await start(true);
    await submit("graceful-recovery");
    await vi.waitFor(async () =>
      expect((await repository.findAnalysis("graceful-recovery"))?.status).toBe("running"),
    );
    const stop = runtime.stop();
    expect(runtime.stop()).toBe(stop);
    await stop;
    const states = shutdownProgress.filter((progress) => progress.state !== "waiting");
    for (const stage of [
      "runner",
      "delivery",
      "retention",
      "worker_utils",
      "database_pool",
    ] as const) {
      expect(
        states.filter((progress) => progress.stage === stage).map((progress) => progress.state),
      ).toEqual(["started", "completed"]);
    }
    const index = (
      stage: WorkerShutdownProgress["stage"],
      state: WorkerShutdownProgress["state"],
    ): number =>
      states.findIndex((progress) => progress.stage === stage && progress.state === state);
    expect(index("worker_utils", "started")).toBeGreaterThan(index("runner", "completed"));
    expect(index("worker_utils", "started")).toBeGreaterThan(index("delivery", "completed"));
    expect(index("database_pool", "started")).toBeGreaterThan(index("worker_utils", "completed"));
    const pending = await repository.findAnalysis("graceful-recovery");
    expect(pending?.status).toBe("queued");
    expect(pending?.failureSummary?.code).toBe("repository_analysis_interrupted");
    expect(await repository.findReport("graceful-recovery")).toBeUndefined();
    runtime = await start(false);
    await expectReport("graceful-recovery");
    await runtime.stop();
  }, 25_000);

  it("recovers only the confirmed killed child's Worker ID without unlocking another Worker", async () => {
    runtime = await start(true);
    await submit("live-worker-guard");
    await vi.waitFor(async () =>
      expect((await repository.findAnalysis("live-worker-guard"))?.status).toBe("running"),
    );
    const child = spawn(
      process.execPath,
      ["--import", "tsx", fileURLToPath(new URL("./recovery-child.ts", import.meta.url))],
      {
        env: { ...process.env, STACKLENS_RECOVERY_TEST_DATABASE_URL: connectionString },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    let ownerId: string | undefined;
    let ready = false;
    child.on("message", (message: unknown) => {
      if (typeof message !== "object" || message === null) return;
      const id = Reflect.get(message, "ownerId");
      if (typeof id === "string") ownerId = id;
      if (Reflect.get(message, "ready") === true) ready = true;
    });
    try {
      await vi.waitFor(
        () => {
          expect(ready).toBe(true);
          expect(ownerId).toMatch(/^pool-[0-9a-f]{18}$/u);
        },
        { timeout: 15_000 },
      );
      // The parent is already busy, so the child alone picks up the second fixture.
      await submit("killed-worker-recovery");
      await vi.waitFor(
        async () => {
          const active = await pool.query(
            "SELECT locked_by FROM graphile_worker._private_jobs WHERE payload->>'analysisId' = 'killed-worker-recovery'",
          );
          expect(active.rows[0]?.locked_by).toBe(ownerId);
        },
        { timeout: 10_000 },
      );
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited; // Actual OS exit proof, before the administrative unlock.
      await recoverConfirmedDeadOwner(ownerId!, connectionString, {});
      const locks = await pool.query(
        "SELECT payload->>'analysisId' AS id, locked_by FROM graphile_worker._private_jobs ORDER BY id",
      );
      expect(locks.rows.find((row) => row.id === "killed-worker-recovery")?.locked_by).toBeNull();
      expect(locks.rows.find((row) => row.id === "live-worker-guard")?.locked_by).toBeTruthy();
      await runtime.stop();
      runtime = await start(false);
      await expectReport("killed-worker-recovery");
      await expectReport("live-worker-guard");
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        child.kill("SIGKILL");
        await exit;
      }
    }
  }, 35_000);
});
