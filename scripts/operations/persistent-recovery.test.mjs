/* oxlint-disable no-await-in-loop -- Each case restores and removes one owned database before the next case. */
// FR-003/017/021/022, NFR-008/009, SEC-003/007: authenticated staging stays quarantined.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { rootCertificates } from "node:tls";
import { promisify } from "node:util";

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
import { encryptArchive } from "./backup-envelope.mjs";
import { createBackup, restoreBackup, restoreNeonBackup } from "./backup.mjs";
import { requireLocalDatabase, root, sha256, until } from "./common.mjs";
import { stagePersistentRecovery } from "./persistent-recovery.mjs";
import { bundleFiles, sealRecoveryMetadata } from "./portable-recovery-bundle.mjs";

const hostname = "ep-fixture.c-4.ap-southeast-1.aws.neon.tech";
const environment = {
  DATABASE_URL: `postgresql://fixture:private-marker@${hostname}/fixture`,
  STACKLENS_DATABASE_SSL_CA: rootCertificates[0],
};
const identity = (snapshot, source = snapshot.source) => ({
  version: 1,
  scope: "preview",
  sourceCommit: "a".repeat(40),
  runId: "51",
  archiveSha256: snapshot.encryptedSha256,
  fingerprintAlgorithm: "postgres-jsonb-c-v1",
  source,
  executor: { kind: "operator_confirmed_offline_drained" },
  fixture: null,
});
const missing = (error) => error.code === "ENOENT";
async function removeDirectory(directory) {
  assert.equal(dirname(directory), resolve(tmpdir()));
  await rm(directory, { recursive: true, force: true });
}

await test("SEC-003/007: persistent preflight rejects untrusted bundles and unsafe outputs before target I/O", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-staging-input-"));
  const key = randomBytes(32),
    keyPath = join(directory, "key"),
    privateOutput = join(directory, "target.json");
  const header = {
    version: 1,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const archive = encryptArchive(Buffer.from("synthetic dump"), key, header);
  const source = Object.fromEntries(
    [
      "public.analysis",
      "public.analysis_report",
      "public.analysis_delivery",
      "graphile_worker._private_jobs",
      "graphile_worker._private_job_queues",
      "graphile_worker._private_tasks",
      "graphile_worker.migrations",
    ].map((name) => [name, { count: 0, sha256: "b".repeat(64) }]),
  );
  const args = {
    environment,
    bundleDirectory: directory,
    keyPath,
    privateDirectory: directory,
    sourceRunId: "51",
    privateOutput,
    target: { kind: "neon", hostname },
  };
  try {
    await writeFile(keyPath, key);
    await writeFile(join(directory, bundleFiles[0]), archive);
    await sealRecoveryMetadata(
      directory,
      key,
      identity({ source, encryptedSha256: sha256(archive) }),
      header,
    );
    await t.test("NFR-009: a wrong capture run never opens the target", async () => {
      await assert.rejects(
        stagePersistentRecovery({ ...args, sourceRunId: "52" }),
        /recovery_bundle_unreadable_or_expired/u,
      );
      await assert.rejects(readFile(privateOutput), missing);
    });
    await t.test("SEC-007: substituted ciphertext never opens the target", async () => {
      await writeFile(
        join(directory, bundleFiles[0]),
        encryptArchive(Buffer.from("other dump"), key, header),
      );
      await assert.rejects(stagePersistentRecovery(args), /recovery_bundle_unreadable_or_expired/u);
      await assert.rejects(readFile(privateOutput), missing);
      await writeFile(join(directory, bundleFiles[0]), archive);
    });
    await t.test(
      "SEC-007: existing private output is preserved without contacting the target",
      async () => {
        await writeFile(privateOutput, "existing private configuration");
        await assert.rejects(stagePersistentRecovery(args), (error) => error.code === "EEXIST");
        assert.equal(await readFile(privateOutput, "utf8"), "existing private configuration");
      },
    );
    await t.test(
      "SEC-007: a misleading dot-dot name inside Git cannot receive credentials",
      async () => {
        const parent = resolve(root, ".cache", `..staging_${randomUUID()}`);
        await mkdir(parent, { recursive: true });
        try {
          await assert.rejects(
            stagePersistentRecovery({ ...args, privateOutput: join(parent, "target.json") }),
            /private_configuration_must_stay_outside_repository/u,
          );
          assert.deepEqual(await readdir(parent), []);
        } finally {
          assert.equal(dirname(parent), resolve(root, ".cache"));
          await rm(parent, { recursive: true, force: true });
        }
      },
    );
    await t.test("SEC-007: CLI failure evidence omits credentials and raw errors", async () => {
      const config = join(directory, "owner.json"),
        evidence = join(directory, "evidence.json");
      await writeFile(config, JSON.stringify(environment));
      await assert.rejects(
        promisify(execFile)(process.execPath, [
          resolve(root, "scripts/operations/persistent-recovery.mjs"),
          "stage-neon",
          config,
          directory,
          keyPath,
          "52",
          hostname,
          privateOutput,
          evidence,
        ]),
        (error) => {
          assert.equal(error.code, 1);
          assert(!error.stdout.includes("private-marker"));
          assert(!error.stderr.includes("private-marker"));
          assert(!error.stderr.includes(hostname));
          return true;
        },
      );
      assert.deepEqual(JSON.parse(await readFile(evidence, "utf8")), {
        status: "failed",
        failureCode: "persistent_recovery_staging_failed",
        targetRemainsQuarantined: true,
      });
    });
  } finally {
    await removeDirectory(directory);
  }
});

await test("SEC-007: restore binds a re-read archive to the authenticated bundle digest before network I/O", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-staging-digest-"));
  const keyPath = join(directory, "key"),
    archivePath = join(directory, "archive");
  try {
    const key = randomBytes(32);
    await writeFile(keyPath, key);
    await writeFile(
      archivePath,
      encryptArchive(Buffer.from("synthetic dump"), key, {
        version: 1,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    );
    await assert.rejects(
      restoreBackup(
        { DATABASE_URL: "postgresql://fixture:private-marker@127.0.0.1:1/fixture" },
        archivePath,
        keyPath,
        directory,
        undefined,
        "0".repeat(64),
      ),
      /backup_identity_mismatch/u,
    );
    await assert.rejects(
      restoreNeonBackup(
        environment,
        archivePath,
        keyPath,
        directory,
        hostname,
        undefined,
        undefined,
        "0".repeat(64),
      ),
      /backup_identity_mismatch/u,
    );
  } finally {
    await removeDirectory(directory);
  }
});

await test(
  "NFR-008/009, SEC-003/007: real PostgreSQL staging retains only a verified drained target and rolls back rejected targets",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "stacklens-staging-database-"));
    const url = requireLocalDatabase(process.env.TEST_DATABASE_URL);
    const admin = createStackLensPool(url.toString(), undefined, { max: 1 });
    const sourceName = `stacklens_staging_${randomUUID().replaceAll("-", "")}`;
    let pool,
      api,
      worker,
      targetName,
      sourceCreated = false;
    const restoreNames = async () =>
      (
        await admin.query(
          "SELECT datname FROM pg_database WHERE datname LIKE 'stacklens_restore_%' ORDER BY datname",
        )
      ).rows;
    try {
      await admin.query(`CREATE DATABASE "${sourceName}"`);
      sourceCreated = true;
      url.pathname = `/${sourceName}`;
      const connectionString = url.toString();
      pool = createStackLensPool(connectionString, undefined, { max: 1 });
      const repository = new DrizzleAnalysisRepository(createStackLensDatabase(pool));
      api = await createStackLensApiRuntime({
        connectionString,
        logger: false,
        databasePoolOptions: { max: 2 },
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
        await until(async () =>
          (await repository.findAnalysis(id))?.status.startsWith("completed"),
        );
      }
      const reportHash = sha256(JSON.stringify((await repository.findReport(ids[0])).report));
      await worker.stop();
      worker = undefined;
      await api.stop();
      api = undefined;
      await pool.query(
        "UPDATE analysis SET retention_expires_at = now() - interval '1 hour' WHERE id = $1",
        [ids[1]],
      );
      const key = randomBytes(32),
        keyPath = join(directory, "key");
      await writeFile(keyPath, key);
      const capture = async (name, alter = (value) => value) => {
        const bundleDirectory = join(directory, name);
        const snapshot = await createBackup(
          { DATABASE_URL: connectionString },
          join(bundleDirectory, bundleFiles[0]),
          keyPath,
          directory,
        );
        await sealRecoveryMetadata(
          bundleDirectory,
          key,
          identity(snapshot, alter(snapshot.source)),
          snapshot,
        );
        return {
          environment: { DATABASE_URL: connectionString },
          bundleDirectory,
          keyPath,
          privateDirectory: directory,
          sourceRunId: "51",
          privateOutput: join(directory, `${name}.json`),
          target: { kind: "local" },
        };
      };
      await t.test(
        "FR-017/022, SEC-003: matching snapshot retains one strict historical report after expiry cleanup",
        async () => {
          const args = await capture("valid");
          const result = await stagePersistentRecovery(args);
          const configuration = JSON.parse(await readFile(args.privateOutput, "utf8"));
          targetName = new URL(configuration.DATABASE_URL).pathname.slice(1);
          assert.match(targetName, /^stacklens_restore_[0-9a-f]{32}$/u);
          assert.equal(result.status, "verified_persistent_target_quarantined");
          assert.equal(result.tableFingerprintCount, 7);
          assert.equal(result.expiredTerminalRowsRemoved, 1);
          assert.deepEqual(result.historicalReportHashes, [reportHash]);
          assert.equal(result.retainedReports, 1);
          assert.equal(result.drained, true);
          assert.equal(result.queueStarted, false);
          assert.equal(result.publicRoutingChanged, false);
          assert.equal(result.persistentDatabaseRetained, true);
          assert(!JSON.stringify(result).includes(targetName));
          assert.equal(
            (await pool.query("SELECT count(*)::int AS count FROM analysis_report")).rows[0].count,
            2,
          );
          assert.equal(
            (await readdir(directory)).some((name) => /\.(?:env|pem|dump)$/u.test(name)),
            false,
          );
        },
      );
      await t.test(
        "NFR-009: authenticated but incorrect fingerprints remove the newly owned database and login",
        async () => {
          const before = await restoreNames();
          const args = await capture("mismatch", (source) => ({
            ...source,
            "public.analysis": {
              ...source["public.analysis"],
              count: source["public.analysis"].count + 1,
            },
          }));
          await assert.rejects(stagePersistentRecovery(args), /recovery_snapshot_mismatch/u);
          await assert.rejects(readFile(args.privateOutput), missing);
          assert.deepEqual(await restoreNames(), before);
        },
      );
      await t.test(
        "NFR-008/009: pending outbox and in-flight analyses cannot be published as a drained target",
        async () => {
          await repository.createQueuedRepositoryAnalysisWithDelivery({
            id: randomUUID(),
            repositoryUrl: "https://github.com/acme/demo",
            createdAt: new Date().toISOString(),
          });
          const before = await restoreNames(),
            args = await capture("pending");
          await assert.rejects(
            stagePersistentRecovery(args),
            /persistent_recovery_requires_drained_snapshot/u,
          );
          await assert.rejects(readFile(args.privateOutput), missing);
          assert.deepEqual(await restoreNames(), before);
          assert.equal(
            (await pool.query("SELECT count(*)::int AS count FROM analysis WHERE status='queued'"))
              .rows[0].count,
            1,
          );
        },
      );
    } finally {
      await worker?.stop();
      await api?.stop();
      await pool?.end();
      try {
        if (targetName) {
          assert.match(targetName, /^stacklens_restore_[0-9a-f]{32}$/u);
          await admin.query(`DROP DATABASE "${String(targetName)}"`);
        }
        if (sourceCreated) await admin.query(`DROP DATABASE "${sourceName}"`);
      } finally {
        await admin.end();
        await removeDirectory(directory);
      }
    }
  },
);
