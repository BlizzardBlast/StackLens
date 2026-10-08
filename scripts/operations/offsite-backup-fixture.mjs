/* oxlint-disable no-await-in-loop -- Fixture submissions finish in order before the consistent capture. */
// NFR-010, SEC-001/003/007: synthetic online snapshot with retained/expired reports and quarantined work.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import {
  createRepositoryAnalysisTaskList,
  startStackLensWorker,
} from "../../apps/worker/dist/index.js";
import { recoveryProviders } from "../../apps/worker/test/recovery-fixtures.ts";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "../../packages/persistence/dist/index.js";
import { REPOSITORY_ANALYSIS_TASK_IDENTIFIER } from "../../packages/repository-jobs/dist/index.js";
import { cleanupSteps, record, requireLocalDatabase, sha256, until } from "./common.mjs";
import { backupRepository } from "./offsite-backup-bundle.mjs";
import { captureOnlineBackup } from "./offsite-backup.mjs";
import { fixtureKey } from "./portable-recovery-bundle.mjs";

// Resolve the runtime dependency through the workspace that declares and owns it.
const { makeWorkerUtils } = createRequire(
  new URL("../../apps/worker/package.json", import.meta.url),
)("graphile-worker");

export async function captureOffsiteFixture({
  environment,
  bundleDirectory,
  identity,
  expireAllReports = false,
}) {
  const url = requireLocalDatabase(environment.DATABASE_URL);
  const name = `stacklens_offsite_${randomUUID().replaceAll("-", "")}`;
  const admin = createStackLensPool(url.toString(), undefined, { max: 1 });
  let created = false,
    pool,
    api,
    worker,
    utils,
    result,
    failure;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    url.pathname = `/${name}`;
    const connectionString = url.toString();
    pool = createStackLensPool(connectionString, undefined, { max: 1 });
    const repository = new DrizzleAnalysisRepository(createStackLensDatabase(pool));
    api = await createStackLensApiRuntime({
      connectionString,
      databasePoolOptions: { max: 2 },
      logger: false,
    });
    worker = await startStackLensWorker({
      connectionString,
      concurrency: 1,
      retentionCleanup: false,
      databasePoolOptions: { max: 5 },
      taskList: createRepositoryAnalysisTaskList({
        repository,
        analysisDependencies: recoveryProviders(),
      }),
    });
    const ids = [];
    for (let i = 0; i < 2; i++) {
      const response = await api.app.inject({
        method: "POST",
        url: "/v1/analyses/repository",
        payload: { repositoryUrl: "https://github.com/acme/demo" },
      });
      assert.equal(response.statusCode, 202);
      const id = response.json().analysisId;
      ids.push(id);
      await until(async () => (await repository.findAnalysis(id))?.status.startsWith("completed"));
    }
    const retainedHash = sha256(JSON.stringify((await repository.findReport(ids[0])).report));
    await pool.query(
      "UPDATE analysis SET retention_expires_at=now()-interval '1 hour' WHERE id=$1",
      [ids[1]],
    );
    if (expireAllReports)
      await pool.query(
        "UPDATE analysis SET retention_expires_at=now()-interval '1 hour' WHERE id=$1",
        [ids[0]],
      );
    const queued = randomUUID();
    await repository.createQueuedRepositoryAnalysisWithDelivery({
      id: queued,
      repositoryUrl: "https://github.com/acme/demo",
      createdAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    utils = await makeWorkerUtils({ pgPool: pool });
    await utils.addJob(
      REPOSITORY_ANALYSIS_TASK_IDENTIFIER,
      { analysisId: queued },
      { runAt: new Date(Date.now() + 3600_000) },
    );
    // A synthetic locked record tests preservation; it is never treated as proof of a dead executor.
    await pool.query(
      "UPDATE graphile_worker._private_jobs SET locked_by='pool-000000000000000000', locked_at=now() WHERE payload->>'analysisId'=$1",
      [queued],
    );
    result = await captureOnlineBackup({
      environment: { DATABASE_URL: connectionString },
      bundleDirectory,
      master: fixtureKey,
      identity,
    });
    assert.equal(result.source["public.analysis_report"].count, 2);
    assert.equal(result.source["graphile_worker._private_jobs"].count, 1);
    assert.equal(result.source["public.analysis_delivery"].count >= 1, true);
    assert.equal((await repository.findAnalysis(queued)).status, "queued");
    assert.equal(
      sha256(JSON.stringify((await repository.findReport(ids[0])).report)),
      retainedHash,
    );
    result = {
      ...result,
      fixtureRetainedReportHash: retainedHash,
      sourceRuntimesAliveDuringCapture: true,
      syntheticLockedRecord: true,
      sourceReportsUnchanged: true,
    };
  } catch (error) {
    failure = error;
  }
  const cleanupFailures = await cleanupSteps([
    ["stopWorker", () => worker?.stop()],
    ["stopApi", () => api?.stop()],
    ["releaseUtils", () => utils?.release()],
    ["closePool", () => pool?.end()],
    ["dropSource", () => (created ? admin.query(`DROP DATABASE "${name}"`) : undefined)],
    ["closeAdmin", () => admin.end()],
  ]);
  if (failure || cleanupFailures.length) throw new Error("offsite_fixture_capture_failed");
  return { ...result, ownedSourceDatabaseRemoved: true };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let evidence = { status: "failed", failureCode: "offsite_fixture_capture_failed" };
  try {
    evidence = await captureOffsiteFixture({
      environment: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
      bundleDirectory: process.argv[2],
      identity: {
        repository: backupRepository,
        runId: process.env.GITHUB_RUN_ID ?? "1",
        sourceCommit: process.env.GITHUB_SHA ?? "0".repeat(40),
        scope: "fixture",
      },
    });
  } catch {
    process.exitCode = 1;
  }
  await record(process.argv[3] ?? ".cache/operations/offsite-fixture.json", evidence);
}
