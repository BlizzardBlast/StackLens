/* oxlint-disable no-await-in-loop -- Capture, confirmed executor exit, restore and HTTP readbacks are ordered phases. */
// FR-003/017/021/022, NFR-008/009, SEC-003/007: isolated replacement compute; no public routing change.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import {
  createRepositoryAnalysisTaskList,
  startStackLensWorker,
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
  readPrivateConfiguration,
  record,
  requireLocalDatabase,
  removePrivateFile,
  root,
  sha256,
  sourceIdentity,
  until,
} from "./common.mjs";
import {
  bundleFiles,
  fixtureKey,
  readRecoveryBundle,
  sealRecoveryMetadata,
} from "./portable-recovery-bundle.mjs";

const [action, directoryArgument, evidenceArgument] = process.argv.slice(2);
const scope = action?.endsWith("-fixture") ? "fixture" : "preview";
const capture = action?.startsWith("capture-");
const directory = resolve(directoryArgument ?? ".cache/portable-recovery-bundle");
const privateDirectory = resolve(root, ".cache/operations-private", randomUUID());
const keyPath = resolve(privateDirectory, "key");
const sourceRunId =
  process.env.STACKLENS_RECOVERY_SOURCE_RUN_ID ?? process.env.GITHUB_RUN_ID ?? "1";
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
  startedAt: new Date().toISOString(),
  status: "pending",
  scope,
  providers: "synthetic replacement-runtime verification; historical reports are never rescored",
};
let api,
  worker,
  pool,
  admin,
  child,
  ownedDatabase,
  ownsBundle = false;
const localEnvironment = { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" };
let key;

const repositoryFor = (connection) =>
  new DrizzleAnalysisRepository(createStackLensDatabase(connection));
async function startWorker(connectionString, repository) {
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
async function submit(runtime) {
  const response = await runtime.app.inject({
    method: "POST",
    url: "/v1/analyses/repository",
    payload: { repositoryUrl: "https://github.com/acme/demo" },
  });
  assert.equal(response.statusCode, 202);
  return response.json().analysisId;
}
async function reportHash(repository, id) {
  await until(async () => (await repository.findAnalysis(id))?.status.startsWith("completed"));
  const stored = await repository.findReport(id);
  assert.equal(stored?.report.schemaVersion, "2.0.0");
  return sha256(JSON.stringify(stored));
}
async function stopChild() {
  if (!child) return;
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await until(() => child.exitCode !== null || child.signalCode !== null);
}
async function fixtureCapture() {
  const url = requireLocalDatabase(localEnvironment.DATABASE_URL);
  const databaseName = `stacklens_portable_${randomUUID().replaceAll("-", "")}`;
  admin = createStackLensPool(url.toString(), undefined, { max: 1 });
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  ownedDatabase = databaseName;
  url.pathname = `/${ownedDatabase}`;
  const connectionString = url.toString();
  pool = createStackLensPool(connectionString, undefined, { max: 1 });
  const repository = repositoryFor(pool);
  api = await createStackLensApiRuntime({
    connectionString,
    logger: false,
    databasePoolOptions: { max: 2 },
  });
  worker = await startWorker(connectionString, repository);
  const completedId = await submit(api),
    completedHash = await reportHash(repository, completedId);
  const expiredId = await submit(api);
  await reportHash(repository, expiredId);
  await worker.stop();
  worker = undefined;
  await pool.query(
    "UPDATE analysis SET retention_expires_at = now() - interval '1 hour' WHERE id = $1",
    [expiredId],
  );
  let ownerId,
    ready = false,
    childFailed = false;
  child = spawn(process.execPath, ["--import", "tsx", "test/recovery-child.ts"], {
    cwd: resolve(root, "apps/worker"),
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      STACKLENS_RECOVERY_TEST_DATABASE_URL: connectionString,
    },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  child.on("error", () => {
    childFailed = true;
  });
  child.on("message", (message) => {
    if (typeof message?.ownerId === "string") ownerId = message.ownerId;
    if (message?.ready === true) ready = true;
  });
  await until(() => {
    assert(!childFailed);
    return ready && /^pool-[0-9a-f]{18}$/u.test(ownerId ?? "");
  });
  const activeId = await submit(api);
  await until(async () => (await repository.findAnalysis(activeId))?.status === "running");
  const queuedId = await submit(api);
  await until(
    async () =>
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM graphile_worker._private_jobs WHERE payload->>'analysisId' = $1",
          [queuedId],
        )
      ).rows[0].count === 1,
  );
  const outboxId = randomUUID();
  await repository.createQueuedRepositoryAnalysisWithDelivery({
    id: outboxId,
    repositoryUrl: "https://github.com/acme/demo",
    createdAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  const snapshot = await createBackup(
    { DATABASE_URL: connectionString },
    resolve(directory, bundleFiles[0]),
    keyPath,
    privateDirectory,
  );
  assert.equal(snapshot.source["graphile_worker._private_jobs"].count, 2);
  await api.stop();
  api = undefined;
  await stopChild();
  assert.equal(
    (
      await pool.query(
        "SELECT locked_by FROM graphile_worker._private_jobs WHERE payload->>'analysisId' = $1",
        [activeId],
      )
    ).rows[0].locked_by,
    ownerId,
  );
  return {
    snapshot,
    executor: { kind: "confirmed_child_exit", ownerId },
    fixture: { completedId, completedHash, expiredId, activeId, queuedId, outboxId },
  };
}

async function previewCapture() {
  assert.equal(
    process.env.STACKLENS_ORIGINAL_COMPUTE_OFFLINE,
    "true",
    "original_api_and_worker_must_be_confirmed_offline",
  );
  const configuration = process.env.STACKLENS_RECOVERY_DATABASE ?? "";
  assert(Buffer.byteLength(configuration) <= 16 * 1024);
  const configurationPath = resolve(privateDirectory, "database.json");
  await writeFile(configurationPath, configuration, { mode: 0o600, flag: "wx" });
  const environment = await readPrivateConfiguration(configurationPath);
  pool = createStackLensPool(environment.DATABASE_URL, undefined, {
    max: 1,
    ...(environment.STACKLENS_DATABASE_SSL_CA
      ? { sslCa: environment.STACKLENS_DATABASE_SSL_CA.replaceAll("\\n", "\n") }
      : {}),
  });
  await assertDrained(pool);
  const snapshot = await createBackup(
    environment,
    resolve(directory, bundleFiles[0]),
    keyPath,
    privateDirectory,
  );
  await assertDrained(pool);
  assert.equal(snapshot.source["graphile_worker._private_jobs"].count, 0);
  return { snapshot, executor: { kind: "operator_confirmed_offline_drained" }, fixture: null };
}
async function assertDrained(connection) {
  const counts = (
    await connection.query(
      "SELECT (SELECT count(*) FROM analysis WHERE status IN ('queued','running'))::int AS in_flight, (SELECT count(*) FROM graphile_worker._private_jobs)::int AS jobs, (SELECT count(*) FROM analysis_delivery WHERE delivered_at IS NULL)::int AS pending",
    )
  ).rows[0];
  assert.deepEqual(counts, { in_flight: 0, jobs: 0, pending: 0 }, "preview_must_be_drained");
}

async function recover() {
  // Authenticate both ciphertexts, scope and source-run binding before creating any database.
  const { value, header } = await readRecoveryBundle(directory, key, scope, sourceRunId);
  const targetUrl = requireLocalDatabase(localEnvironment.DATABASE_URL);
  const restored = await restoreBackup(
    localEnvironment,
    resolve(directory, bundleFiles[0]),
    keyPath,
    privateDirectory,
  );
  ownedDatabase = restored.databaseName;
  admin = createStackLensPool(targetUrl.toString(), undefined, { max: 1 });
  assert.deepEqual(restored.restoredSnapshot, value.source);
  assert.equal(restored.queueStarted, false);
  pool = createStackLensPool(restored.connectionString, undefined, { max: 1 });
  const repository = repositoryFor(pool);
  // Hash stored reports after terminal expiry cleanup and before starting replacement runtimes.
  const historical = new Map();
  for (const row of (await pool.query("SELECT analysis_id FROM analysis_report")).rows)
    historical.set(
      row.analysis_id,
      sha256(JSON.stringify(await repository.findReport(row.analysis_id))),
    );
  if (scope === "fixture") {
    assert.equal(restored.expiredTerminalRowsRemoved, 1);
    assert.equal(await repository.findAnalysis(value.fixture.expiredId), undefined);
    assert.equal(
      await reportHash(repository, value.fixture.completedId),
      value.fixture.completedHash,
    );
    await recoverConfirmedDeadOwner(value.executor.ownerId, restored.connectionString, {});
    // Only this synthetic deferred outbox record has its clock advanced.
    await pool.query("UPDATE analysis_delivery SET available_at = now() WHERE analysis_id = $1", [
      value.fixture.outboxId,
    ]);
  } else await assertDrained(pool); // Live copied claims are never unlocked or replayed automatically.
  worker = await startWorker(restored.connectionString, repository);
  if (scope === "fixture") {
    for (const id of [value.fixture.activeId, value.fixture.queuedId, value.fixture.outboxId])
      await reportHash(repository, id);
    evidence.replayed = { activeQueueJob: 1, queuedJob: 1, pendingOutbox: 1 };
  }
  api = await createStackLensApiRuntime({
    connectionString: restored.connectionString,
    logger: false,
    startDeliveryPump: false,
    databaseMode: "worker-managed",
    databasePoolOptions: { max: 2 },
  });
  const origin = await api.app.listen({ host: "127.0.0.1", port: 0 });
  const request = async (path, options) =>
    fetch(`${origin}${path}`, { ...options, signal: AbortSignal.timeout(10_000) });
  let readbacks = 0;
  for (const id of historical.keys()) {
    const response = await request(`/v1/analyses/${id}`);
    assert.equal(response.status, 200);
    assert.match((await response.json()).status, /^completed/u);
    readbacks++;
  }
  if (scope === "fixture") {
    assert.equal((await request(`/v1/analyses/${value.fixture.expiredId}`)).status, 404);
    for (const id of [value.fixture.activeId, value.fixture.queuedId, value.fixture.outboxId]) {
      const response = await request(`/v1/analyses/${id}`);
      assert.equal(response.status, 200);
      assert.match((await response.json()).status, /^completed/u);
      readbacks++;
    }
  }
  const submission = await request("/v1/analyses/repository", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repositoryUrl: "https://github.com/acme/demo" }),
  });
  assert.equal(submission.status, 202);
  const id = (await submission.json()).analysisId;
  await reportHash(repository, id);
  assert.equal((await request(`/v1/analyses/${id}`)).status, 200);
  for (const [historicalId, expected] of historical)
    assert.equal(sha256(JSON.stringify(await repository.findReport(historicalId))), expected);
  await until(
    async () =>
      (await pool.query("SELECT count(*)::int AS count FROM graphile_worker._private_jobs")).rows[0]
        .count === 0,
  );
  evidence.backup = {
    createdAt: header.createdAt,
    expiresAt: header.expiresAt,
    sourceCommit: value.sourceCommit,
    sourceRunId,
    archiveSha256: value.archiveSha256,
  };
  evidence.snapshotHashesMatched = true;
  evidence.expiredTerminalRowsRemoved = restored.expiredTerminalRowsRemoved;
  evidence.historicalReportsUnchanged = historical.size;
  evidence.httpReadbacks = readbacks + 1;
  evidence.newDurableSubmissionCompleted = true;
  evidence.originalResourcesContactedDuringRecovery = false;
}

try {
  assert(
    ["capture-fixture", "capture-preview", "recover-fixture", "recover-preview"].includes(action),
  );
  assert.match(sourceRunId, /^[0-9]+$/u);
  Object.assign(evidence, await sourceIdentity());
  key =
    scope === "fixture"
      ? fixtureKey
      : (() => {
          const hex = process.env.STACKLENS_RECOVERY_KEY ?? "";
          assert.match(hex, /^[0-9a-f]{64}$/u);
          const value = Buffer.from(hex, "hex");
          assert(!value.equals(fixtureKey));
          return value;
        })();
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  await writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
  if (capture) {
    await mkdir(dirname(directory), { recursive: true });
    await mkdir(directory, { mode: 0o700 });
    ownsBundle = true;
    const { snapshot, executor, fixture } = await (scope === "fixture"
      ? fixtureCapture()
      : previewCapture());
    await sealRecoveryMetadata(
      directory,
      key,
      {
        version: 1,
        scope,
        sourceCommit: evidence.baseCommit,
        runId: sourceRunId,
        archiveSha256: snapshot.encryptedSha256,
        fingerprintAlgorithm: snapshot.fingerprintAlgorithm,
        source: snapshot.source,
        executor,
        fixture,
      },
      snapshot,
    );
    evidence.backup = {
      createdAt: snapshot.createdAt,
      expiresAt: snapshot.expiresAt,
      archiveSha256: snapshot.encryptedSha256,
    };
    evidence.originalExecutor = executor.kind;
  } else await recover();
  evidence.status = "verified";
} catch {
  evidence.status = "failed";
  process.exitCode = 1;
} finally {
  evidence.cleanupFailures = await cleanupSteps([
    ["stopOriginalChild", stopChild],
    ["stopReplacementWorker", () => worker?.stop()],
    ["stopApi", () => api?.stop()],
    ["closePool", () => pool?.end()],
    [
      "dropOwnedDatabase",
      () => (ownedDatabase && admin ? admin.query(`DROP DATABASE "${ownedDatabase}"`) : undefined),
    ],
    ["closeAdmin", () => admin?.end()],
    [
      "removePrivateDirectory",
      () => {
        // Check the absolute recursive-delete target stays inside the intended private workspace.
        assert.match(
          relative(resolve(root, ".cache/operations-private"), privateDirectory),
          /^[0-9a-f-]{36}$/u,
        );
        return rm(privateDirectory, { recursive: true, force: true });
      },
    ],
  ]);
  if (ownsBundle && (evidence.status !== "verified" || evidence.cleanupFailures.length)) {
    evidence.cleanupFailures.push(
      ...(await cleanupSteps([
        [
          "removeFailedBundle",
          async () => {
            for (const name of bundleFiles) await removePrivateFile(resolve(directory, name));
            await rmdir(directory); // Remove only the newly created empty directory; preserve unknown files.
          },
        ],
      ])),
    );
  }
  if (evidence.cleanupFailures.length) {
    evidence.status = "failed";
    process.exitCode = 1;
  }
  evidence.cleanedUp = evidence.cleanupFailures.length === 0;
  evidence.finishedAt = new Date().toISOString();
  await record(evidenceArgument ?? ".cache/operations/portable-recovery.json", evidence);
}
