/* oxlint-disable no-await-in-loop -- Report readbacks and cleanup are bounded ordered operations. */
// NFR-010/009, SEC-003/007, FR-003/017/022: online capture and isolated readback, never queue replay.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { createBackup, fingerprint, restoreBackup } from "./backup.mjs";
import {
  cleanupSteps,
  readPrivateConfiguration,
  record,
  removePrivateFile,
  requireLocalDatabase,
  root,
  sha256,
} from "./common.mjs";
import {
  backupRepository,
  deriveArchiveKey,
  offsiteFiles,
  readOnlineBackup,
  retentionLabel,
  sealOnlineMetadata,
} from "./offsite-backup-bundle.mjs";
import { fixtureKey } from "./portable-recovery-bundle.mjs";

async function privateWorkspace() {
  const parent = resolve(root, ".cache/operations-private");
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(resolve(parent, "offsite-"));
  return {
    directory,
    async cleanup() {
      assert.match(relative(parent, directory), /^offsite-[A-Za-z0-9]+$/u);
      await rm(directory, { recursive: true, force: true });
    },
  };
}
export async function captureOnlineBackup({ environment, bundleDirectory, master, identity }) {
  const key = deriveArchiveKey(master, identity);
  if (identity.scope === "fixture") requireLocalDatabase(environment.DATABASE_URL);
  else assert(environment.STACKLENS_DATABASE_SSL_CA, "preview_backup_requires_verified_tls");
  await mkdir(dirname(resolve(bundleDirectory)), { recursive: true });
  await mkdir(bundleDirectory, { mode: 0o700 }); // Own only a new directory, never overwrite a bundle.
  let privateFiles, result, failure;
  try {
    privateFiles = await privateWorkspace();
    const keyPath = resolve(privateFiles.directory, "key");
    await writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
    const snapshot = await createBackup(
      environment,
      resolve(bundleDirectory, offsiteFiles[0]),
      keyPath,
      privateFiles.directory,
    );
    const value = {
      version: 1,
      purpose: "online-backup",
      ...identity,
      archiveSha256: snapshot.encryptedSha256,
      fingerprintAlgorithm: snapshot.fingerprintAlgorithm,
      source: snapshot.source,
    };
    await sealOnlineMetadata(bundleDirectory, key, value, snapshot);
    result = {
      status: "verified_capture",
      ...identity,
      artifactName: retentionLabel(master, value, snapshot),
      backup: {
        createdAt: snapshot.createdAt,
        expiresAt: snapshot.expiresAt,
        archiveSha256: snapshot.encryptedSha256,
      },
      source: snapshot.source,
      originalComputePaused: false,
      queueStarted: false,
    };
  } catch (error) {
    failure = error;
  }
  const cleanupFailures = await cleanupSteps([
    ["removePrivateFiles", () => privateFiles?.cleanup()],
  ]);
  if (failure || cleanupFailures.length) {
    await cleanupSteps([
      [
        "removeOwnedFailedBundle",
        async () => {
          for (const name of offsiteFiles) await removePrivateFile(resolve(bundleDirectory, name));
          await rmdir(bundleDirectory);
        },
      ],
    ]);
    throw new Error("online_backup_capture_failed");
  }
  return { ...result, transientPrivateFilesRemoved: true };
}
export async function verifyOnlineBackup({ environment, bundleDirectory, master, expected }) {
  // No connection or private client file is created until both ciphertexts authenticate.
  const { value, header, key } = await readOnlineBackup(bundleDirectory, master, expected);
  const original = requireLocalDatabase(environment.DATABASE_URL);
  let privateFiles, admin, pool, api, ownedDatabase, result, failure;
  try {
    privateFiles = await privateWorkspace();
    const keyPath = resolve(privateFiles.directory, "key");
    await writeFile(keyPath, key, { mode: 0o600, flag: "wx" });
    admin = createStackLensPool(original.toString(), undefined, { max: 1 });
    const restoreResult = await restoreBackup(
      environment,
      resolve(bundleDirectory, offsiteFiles[0]),
      keyPath,
      privateFiles.directory,
      async (restored) => {
        ownedDatabase = restored.databaseName;
        assert.match(ownedDatabase, /^stacklens_restore_[0-9a-f]{32}$/u);
        assert.deepEqual(restored.restoredSnapshot, value.source);
        assert.deepEqual(restored.metadata, header);
        assert.equal(restored.queueStarted, false);
        pool = createStackLensPool(restored.connectionString, undefined, { max: 1 });
        const before = await fingerprint(pool);
        const reports = (
          await pool.query("SELECT analysis_id, report FROM analysis_report ORDER BY analysis_id")
        ).rows;
        for (const row of reports) AnalysisReportSchema.parse(row.report);
        const hashes = reports.map((row) => sha256(JSON.stringify(row.report))).toSorted();
        api = await createStackLensApiRuntime({
          connectionString: restored.connectionString,
          databaseMode: "worker-managed",
          startDeliveryPump: false,
          databasePoolOptions: { max: 1 },
          logger: false,
        });
        for (const row of reports) {
          const response = await api.app.inject({
            method: "GET",
            url: `/v1/analyses/${row.analysis_id}`,
          });
          assert.equal(response.statusCode, 200);
          assert.deepEqual(
            AnalysisReportSchema.parse(response.json().report),
            AnalysisReportSchema.parse(row.report),
          );
          assert.equal(response.headers["cache-control"], "private, no-store");
        }
        const missing = await api.app.inject({
          method: "GET",
          url: "/v1/analyses/offsite-readback-missing",
        });
        assert.equal(missing.statusCode, 404);
        assert.deepEqual(missing.json(), {
          code: "analysis_not_found",
          message: "Analysis was not found.",
        });
        assert.equal(missing.headers["cache-control"], "private, no-store");
        assert.deepEqual(await fingerprint(pool), before);
        assert(Date.now() < Date.parse(header.expiresAt));
        result = {
          status: "verified",
          ...expected,
          backup: { ...header, archiveSha256: value.archiveSha256 },
          matchingTables: Object.keys(value.source).length,
          fingerprintsMatched: true,
          archivedStrictReportReads: restored.reportsRead,
          strictReportReads: reports.length,
          apiReportReads: reports.length,
          populatedReportReadbackCovered: reports.length > 0,
          retainedReportHashes: hashes,
          missingAnalysisApiReadback: true,
          historicalRowsUnchanged: true,
          expiredTerminalRowsRemoved: restored.expiredTerminalRowsRemoved,
          copiedQueueRows: value.source["graphile_worker._private_jobs"].count,
          queueStarted: false,
          liveClaimsUnlocked: false,
          originalDatabaseContacted: false,
        };
        // Close clients inside the callback so backup.mjs can drop its target on verification failure.
        await api.stop();
        api = undefined;
        await pool.end();
        pool = undefined;
      },
      value.archiveSha256,
    );
    assert.equal(restoreResult.databaseName, ownedDatabase);
  } catch (error) {
    failure = error;
  }
  const cleanupFailures = await cleanupSteps([
    ["stopApi", () => api?.stop()],
    ["closePool", () => pool?.end()],
    [
      "dropOwnedDatabase",
      async () => {
        if (!ownedDatabase || !admin) return;
        assert.match(ownedDatabase, /^stacklens_restore_[0-9a-f]{32}$/u);
        const existing = await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [
          ownedDatabase,
        ]);
        if (existing.rows.length) await admin.query(`DROP DATABASE "${ownedDatabase}"`);
        assert.equal(
          (await admin.query("SELECT datname FROM pg_database WHERE datname=$1", [ownedDatabase]))
            .rows.length,
          0,
        );
      },
    ],
    ["closeAdmin", () => admin?.end()],
    ["removePrivateFiles", () => privateFiles?.cleanup()],
  ]);
  if (failure || cleanupFailures.length) throw new Error("online_backup_verification_failed");
  return { ...result, ownedDatabaseRemoved: true, transientPrivateFilesRemoved: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, bundleDirectory, evidencePath] = process.argv.slice(2);
  let privateFiles;
  const evidence = {
    requirementIds: ["NFR-010", "NFR-009", "SEC-003", "SEC-007", "FR-003", "FR-017", "FR-022"],
    status: "pending",
    startedAt: new Date().toISOString(),
  };
  try {
    assert(["capture", "verify", "capture-fixture", "verify-fixture"].includes(action));
    assert(bundleDirectory && evidencePath);
    assert(
      ![...offsiteFiles]
        .map((name) => resolve(bundleDirectory, name))
        .includes(resolve(evidencePath)),
    );
    const scope = action.endsWith("-fixture") ? "fixture" : "preview";
    const identity = {
      repository: backupRepository,
      runId: process.env.GITHUB_RUN_ID ?? "1",
      sourceCommit: process.env.GITHUB_SHA ?? "0".repeat(40),
      scope,
    };
    const hex = process.env.STACKLENS_BACKUP_MASTER ?? "";
    if (scope === "preview") assert.match(hex, /^[0-9a-f]{64}$/u);
    const master = scope === "fixture" ? fixtureKey : Buffer.from(hex, "hex");
    if (action.startsWith("capture")) {
      privateFiles = await privateWorkspace();
      const configuration = resolve(privateFiles.directory, "source.json");
      const input =
        scope === "fixture"
          ? JSON.stringify({ DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" })
          : (process.env.STACKLENS_BACKUP_DATABASE ?? "");
      assert(Buffer.byteLength(input) <= 16 * 1024);
      await writeFile(configuration, input, { flag: "wx", mode: 0o600 });
      Object.assign(
        evidence,
        await captureOnlineBackup({
          environment: await readPrivateConfiguration(configuration),
          bundleDirectory,
          master,
          identity,
        }),
      );
      if (process.env.GITHUB_OUTPUT)
        await writeFile(process.env.GITHUB_OUTPUT, `artifact_name=${evidence.artifactName}\n`, {
          flag: "a",
        });
    } else
      Object.assign(
        evidence,
        await verifyOnlineBackup({
          environment: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
          bundleDirectory,
          master,
          expected: identity,
        }),
      );
  } catch {
    evidence.status = "failed";
    evidence.failureCode = "offsite_backup_failed";
    process.exitCode = 1;
  } finally {
    try {
      await privateFiles?.cleanup();
    } catch {
      evidence.status = "failed";
      process.exitCode = 1;
    }
    evidence.finishedAt = new Date().toISOString();
    await record(evidencePath ?? ".cache/operations/offsite-backup.json", evidence);
  }
}
