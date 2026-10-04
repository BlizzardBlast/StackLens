/* oxlint-disable no-await-in-loop -- Restore, executor fencing and queue replay are ordered recovery phases. */
// FR-003/017/021/022, NFR-008/009, SEC-003/007: local synthetic disaster recovery only.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import {
  startStackLensWorker,
  createRepositoryAnalysisTaskList,
} from "../../apps/worker/dist/index.js";
import { recoverConfirmedDeadOwner } from "../../apps/worker/dist/recovery.js";
import { recoveryProviders } from "../../apps/worker/test/recovery-fixtures.ts";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "../../packages/persistence/dist/index.js";
import { createBackup, restoreBackup } from "./backup.mjs";
import {
  cleanupSteps,
  record,
  removePrivateFile,
  requireLocalDatabase,
  root,
  sha256,
  sourceIdentity,
  until,
} from "./common.mjs";

const sourceAdminUrl = requireLocalDatabase(process.env.TEST_DATABASE_URL ?? "");
const targetAdminUrl = requireLocalDatabase(process.env.RESTORE_DATABASE_URL ?? "");
assert.notEqual(
  sourceAdminUrl.port,
  targetAdminUrl.port,
  "independent_postgresql_targets_required",
);
const sourceName = `stacklens_disaster_${randomUUID().replaceAll("-", "")}`;
const sourceUrl = new URL(sourceAdminUrl);
sourceUrl.pathname = `/${sourceName}`;
const privateDirectory = resolve(root, ".cache/operations-private");
await mkdir(privateDirectory, { recursive: true });
const suffix = randomUUID(),
  archive = resolve(privateDirectory, `${suffix}.slbackup`),
  key = resolve(privateDirectory, `${suffix}.key`);
const admin = createStackLensPool(sourceAdminUrl.toString(), undefined, { max: 1 });
let sourcePool,
  sourceApi,
  sourceWorker,
  child,
  targetPool,
  targetApi,
  targetWorker,
  restored,
  created = false;
const evidence = {
  requirementIds: [
    "FR-003",
    "FR-017",
    "FR-021",
    "FR-022",
    "NFR-008",
    "NFR-009",
    "SEC-003",
    "SEC-007",
  ],
  ...(await sourceIdentity()),
  startedAt: new Date().toISOString(),
  scope:
    "Synthetic providers; separate local PostgreSQL clusters; no live queue or routing changes",
  status: "pending",
};
const repositoryUrl = "https://github.com/acme/demo";
async function submit(api) {
  const result = await api.app.inject({
    method: "POST",
    url: "/v1/analyses/repository",
    payload: { repositoryUrl },
  });
  assert.equal(result.statusCode, 202);
  return result.json().analysisId;
}
async function expectReport(repository, id) {
  await until(
    async () => (await repository.findAnalysis(id))?.status.startsWith("completed"),
    30_000,
  );
  const stored = await repository.findReport(id);
  assert.equal(stored.report.schemaVersion, "2.0.0");
  return sha256(JSON.stringify(stored));
}
async function start(connectionString, repository) {
  return startStackLensWorker({
    connectionString,
    concurrency: 1,
    retentionCleanup: false,
    databasePoolOptions: { max: 5 },
    taskList: createRepositoryAnalysisTaskList({
      repository,
      analysisDependencies: recoveryProviders(),
    }),
  });
}
async function killChild() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exit = once(child, "exit");
    child.kill("SIGKILL");
    await exit;
  }
}
try {
  await admin.query(`CREATE DATABASE "${sourceName}"`);
  created = true;
  sourceApi = await createStackLensApiRuntime({
    connectionString: sourceUrl.toString(),
    databasePoolOptions: { max: 2 },
    logger: false,
  });
  sourcePool = createStackLensPool(sourceUrl.toString(), undefined, { max: 1 });
  const repository = new DrizzleAnalysisRepository(createStackLensDatabase(sourcePool));
  sourceWorker = await start(sourceUrl.toString(), repository);
  const completedId = await submit(sourceApi);
  const completedHash = await expectReport(repository, completedId);
  const expiredId = await submit(sourceApi);
  await expectReport(repository, expiredId);
  await sourceWorker.stop();
  sourceWorker = undefined;
  await sourcePool.query(
    "UPDATE analysis SET retention_expires_at = now() - interval '1 hour' WHERE id = $1",
    [expiredId],
  );

  let ownerId,
    ready = false;
  child = spawn(process.execPath, ["--import", "tsx", "test/recovery-child.ts"], {
    cwd: resolve(root, "apps/worker"),
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      STACKLENS_RECOVERY_TEST_DATABASE_URL: sourceUrl.toString(),
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let childFailed = false;
  child.on("error", () => {
    childFailed = true;
  });
  child.on("message", (message) => {
    if (typeof message?.ownerId === "string") ownerId = message.ownerId;
    if (message?.ready === true) ready = true;
  });
  await until(() => {
    assert(!childFailed, "recovery_child_failed");
    return ready && /^pool-[0-9a-f]{18}$/u.test(ownerId ?? "");
  });
  const activeId = await submit(sourceApi);
  await until(async () => (await repository.findAnalysis(activeId))?.status === "running");
  const queuedId = await submit(sourceApi);
  await until(
    async () =>
      (
        await sourcePool.query(
          "SELECT count(*)::int AS count FROM graphile_worker._private_jobs WHERE payload->>'analysisId' = $1",
          [queuedId],
        )
      ).rows[0].count === 1,
  );
  // Durable outbox-only fixture is deliberately deferred until the post-restore replay phase.
  const outboxId = randomUUID();
  await repository.createQueuedRepositoryAnalysisWithDelivery({
    id: outboxId,
    repositoryUrl,
    createdAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  await writeFile(key, randomBytes(32), { mode: 0o600, flag: "wx" });
  const snapshot = await createBackup(
    { DATABASE_URL: sourceUrl.toString() },
    archive,
    key,
    privateDirectory,
  );
  assert.equal(snapshot.source["graphile_worker._private_jobs"].count, 2);
  await sourceApi.stop();
  sourceApi = undefined;
  await killChild(); // Confirm actual OS exit before touching the copied ownership lock.
  evidence.originalExecutorExited = true;
  assert.equal(
    (
      await sourcePool.query(
        "SELECT locked_by FROM graphile_worker._private_jobs WHERE payload->>'analysisId' = $1",
        [activeId],
      )
    ).rows[0].locked_by,
    ownerId,
  );

  restored = await restoreBackup(
    { DATABASE_URL: targetAdminUrl.toString() },
    archive,
    key,
    privateDirectory,
  );
  assert.deepEqual(restored.restoredSnapshot, snapshot.source);
  assert.equal(restored.expiredTerminalRowsRemoved, 1);
  assert.equal(restored.queueStarted, false);
  evidence.snapshotHashesMatched = true;
  evidence.expiredTerminalRowsRemoved = restored.expiredTerminalRowsRemoved;
  targetPool = createStackLensPool(restored.connectionString, undefined, { max: 1 });
  const targetRepository = new DrizzleAnalysisRepository(createStackLensDatabase(targetPool));
  assert.equal(await targetRepository.findAnalysis(expiredId), undefined);
  assert.equal(await expectReport(targetRepository, completedId), completedHash);
  await recoverConfirmedDeadOwner(ownerId, restored.connectionString, {});
  // Advance this fixture's delivery clock; live records and source claims are never altered.
  await targetPool.query(
    "UPDATE analysis_delivery SET available_at = now() WHERE analysis_id = $1",
    [outboxId],
  );
  targetWorker = await start(restored.connectionString, targetRepository);
  for (const id of [activeId, queuedId, outboxId]) await expectReport(targetRepository, id);
  targetApi = await createStackLensApiRuntime({
    connectionString: restored.connectionString,
    databasePoolOptions: { max: 2 },
    logger: false,
  });
  for (const id of [completedId, activeId, queuedId, outboxId]) {
    const response = await targetApi.app.inject({ method: "GET", url: `/v1/analyses/${id}` });
    assert.equal(response.statusCode, 200);
    assert.match(response.json().status, /^completed/u);
  }
  assert.equal(
    (await targetApi.app.inject({ method: "GET", url: `/v1/analyses/${expiredId}` })).statusCode,
    404,
  );
  assert.equal((await repository.findAnalysis(activeId)).status, "running");
  assert.equal((await repository.findAnalysis(queuedId)).status, "queued");
  assert.equal(await expectReport(targetRepository, completedId), completedHash);
  evidence.replayed = { activeQueueJob: 1, queuedJob: 1, pendingOutbox: 1 };
  evidence.publicReadbacks = 4;
  evidence.sourceClaimsUnchanged = true;
  evidence.historicalReportUnchanged = true;
  evidence.status = "verified_separate_cluster_restore_and_copied_queue_replay";
} catch {
  evidence.status = "failed";
  process.exitCode = 1;
} finally {
  evidence.cleanupFailures = await cleanupSteps([
    ["stopOriginalExecutor", killChild],
    ["stopTargetWorker", () => targetWorker?.stop()],
    ["stopTargetApi", () => targetApi?.stop()],
    ["closeTargetPool", () => targetPool?.end()],
    [
      "dropOwnedRestore",
      async () => {
        if (!restored) return;
        const targetAdmin = createStackLensPool(targetAdminUrl.toString(), undefined, { max: 1 });
        try {
          await targetAdmin.query(`DROP DATABASE "${restored.databaseName}"`);
        } finally {
          await targetAdmin.end();
        }
      },
    ],
    ["stopSourceWorker", () => sourceWorker?.stop()],
    ["stopSourceApi", () => sourceApi?.stop()],
    ["closeSourcePool", () => sourcePool?.end()],
    ["dropOwnedSource", () => (created ? admin.query(`DROP DATABASE "${sourceName}"`) : undefined)],
    ["closeAdmin", () => admin.end()],
    ["removePrivateArchive", () => removePrivateFile(archive)],
    ["removePrivateKey", () => removePrivateFile(key)],
  ]);
  evidence.cleanedUp = evidence.cleanupFailures.length === 0;
  if (!evidence.cleanedUp) {
    evidence.status = "failed";
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[2] ?? ".cache/operations/recovery-rehearsal.json", evidence);
}
