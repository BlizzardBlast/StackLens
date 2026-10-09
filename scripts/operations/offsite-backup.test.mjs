/* oxlint-disable no-await-in-loop -- Synthetic mutation cases and owned database rehearsals are serial. */
// NFR-010/009, SEC-003/007: authentication, custody boundaries, freshness and quarantined real restores.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { encryptArchive } from "./backup-envelope.mjs";
import { requireLocalDatabase, sha256 } from "./common.mjs";
import {
  backupRepository,
  backupWorkflowPath,
  backupVerificationJob,
  deriveArchiveKey,
  authenticateOnlineBackup,
  authenticateRetentionLabel,
  offsiteFiles,
  retentionLabel,
  sealOnlineMetadata,
} from "./offsite-backup-bundle.mjs";
import { captureOffsiteFixture } from "./offsite-backup-fixture.mjs";
import { maintainOffsiteBackups, githubBackupApi } from "./offsite-backup-maintenance.mjs";
import { captureOnlineBackup, verifyOnlineBackup } from "./offsite-backup.mjs";
import { fixtureKey } from "./portable-recovery-bundle.mjs";

const identity = {
  repository: backupRepository,
  scope: "preview",
  runId: "91",
  sourceCommit: "a".repeat(40),
};
const tables = [
  "public.analysis",
  "public.analysis_report",
  "public.analysis_delivery",
  "graphile_worker._private_jobs",
  "graphile_worker._private_job_queues",
  "graphile_worker._private_tasks",
  "graphile_worker.migrations",
];
function synthetic(master, now, changes = {}) {
  const header = {
    version: 1,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 86400_000).toISOString(),
  };
  const key = deriveArchiveKey(master, identity);
  const archive = encryptArchive(Buffer.from("synthetic private dump"), key, header);
  const value = {
    version: 1,
    purpose: "online-backup",
    ...identity,
    archiveSha256: sha256(archive),
    fingerprintAlgorithm: "postgres-jsonb-c-v1",
    source: Object.fromEntries(tables.map((name) => [name, { count: 3, sha256: "b".repeat(64) }])),
    ...changes,
  };
  return {
    header,
    key,
    archive,
    value,
    metadata: encryptArchive(Buffer.from(JSON.stringify(value)), key, header),
  };
}
await test("NFR-010/SEC-007: online bundles allow copied claims but reject wrong custody, identity, content, purpose and expiry", async () => {
  const master = randomBytes(32),
    now = Date.now(),
    input = synthetic(master, now);
  assert.equal(
    authenticateOnlineBackup(input.archive, input.metadata, master, identity, now).value.source[
      "graphile_worker._private_jobs"
    ].count,
    3,
  );
  for (const other of [
    { ...identity, runId: "92" },
    { ...identity, sourceCommit: "c".repeat(40) },
    { ...identity, scope: "fixture" },
  ])
    await assert.rejects(
      async () => authenticateOnlineBackup(input.archive, input.metadata, master, other, now),
      /online_backup_unreadable_or_expired/u,
    );
  for (const altered of [
    { ...input, archive: Buffer.concat([input.archive, Buffer.from("tamper")]) },
    { ...input, metadata: synthetic(master, now, { purpose: "offline-recovery" }).metadata },
    {
      ...input,
      metadata: encryptArchive(Buffer.from(JSON.stringify(input.value)), input.key, {
        ...input.header,
        expiresAt: new Date(now + 60_000).toISOString(),
      }),
    },
    {
      ...input,
      metadata: synthetic(master, now, { extraPrivateField: "private-marker" }).metadata,
    },
  ])
    await assert.rejects(
      async () =>
        authenticateOnlineBackup(altered.archive, altered.metadata, master, identity, now),
      /online_backup_unreadable_or_expired/u,
    );
  await assert.rejects(
    async () =>
      authenticateOnlineBackup(input.archive, input.metadata, randomBytes(32), identity, now),
    /online_backup_unreadable_or_expired/u,
  );
  await assert.rejects(
    async () =>
      authenticateOnlineBackup(input.archive, input.metadata, master, identity, now + 86400_000),
    /online_backup_unreadable_or_expired/u,
  );
  assert.throws(() => deriveArchiveKey(fixtureKey, identity));
});
await test("SEC-003/007: retention labels bind exact lifetime, digest and source identity and separate fixture custody", () => {
  const master = randomBytes(32),
    input = synthetic(master, Date.now());
  const name = retentionLabel(master, input.value, input.header);
  assert.equal(authenticateRetentionLabel(master, name).archiveSha256, input.value.archiveSha256);
  assert.throws(
    () => authenticateRetentionLabel(randomBytes(32), name),
    /unmanaged_or_unauthenticated/u,
  );
  assert.throws(
    () => authenticateRetentionLabel(master, name.replace(identity.sourceCommit, "c".repeat(40))),
    /unmanaged_or_unauthenticated/u,
  );
  assert.throws(
    () => authenticateRetentionLabel(master, name.replace("preview-", "fixture-")),
    /unmanaged_or_unauthenticated/u,
  );
  assert.throws(() =>
    retentionLabel(master, input.value, {
      ...input.header,
      expiresAt: new Date(Date.parse(input.header.createdAt) + 86400_001).toISOString(),
    }),
  );
});

function fakeGithub(master, now, specifications) {
  const artifacts = [],
    runs = new Map(),
    jobs = new Map(),
    deleted = [],
    requests = [];
  for (const [i, specification] of specifications.entries()) {
    const runId = String(100 + i),
      createdAt = now - (specification.ageHours ?? 1) * 3600_000;
    const input = synthetic(master, createdAt);
    input.value.runId = runId;
    const name = specification.name ?? retentionLabel(master, input.value, input.header);
    artifacts.push({
      id: 1000 + i,
      name,
      created_at: new Date(createdAt + 1000).toISOString(),
      expired: false,
      workflow_run: { id: Number(runId) },
    });
    runs.set(runId, {
      id: Number(runId),
      repository: { full_name: backupRepository },
      head_repository: { full_name: backupRepository },
      head_branch: "main",
      head_sha: identity.sourceCommit,
      path: backupWorkflowPath,
      event: "schedule",
      ...specification.run,
    });
    jobs.set(runId, [
      {
        id: 2000 + i,
        name: backupVerificationJob,
        conclusion: specification.conclusion ?? "success",
        started_at: new Date(createdAt + 2000).toISOString(),
        completed_at: new Date(createdAt + 3000).toISOString(),
      },
    ]);
  }
  return {
    deleted,
    requests,
    artifacts,
    api: async (method, path) => {
      requests.push({ method, path });
      if (path.includes("/artifacts?")) return { total_count: artifacts.length, artifacts };
      const run = /\/runs\/([0-9]+)(\/jobs)?/u.exec(path);
      if (run)
        return run[2]
          ? { total_count: jobs.get(run[1]).length, jobs: jobs.get(run[1]) }
          : runs.get(run[1]);
      const artifact = /\/artifacts\/([0-9]+)$/u.exec(path);
      if (artifact && method === "DELETE") {
        deleted.push(Number(artifact[1]));
        return undefined;
      }
      if (artifact && deleted.includes(Number(artifact[1]))) return undefined;
      throw new Error("unexpected_mock_request");
    },
  };
}
await test("NFR-010/SEC-003: maintenance deletes only authenticated expired workflow-owned artifacts and accepts verified fresh custody", async () => {
  const master = randomBytes(32),
    now = Math.floor(Date.now() / 1000) * 1000 + 456;
  const fake = fakeGithub(master, now, [
    { ageHours: 1 },
    { ageHours: 25 },
    { ageHours: 25, name: "unrelated-artifact" },
    { ageHours: 25, run: { path: ".github/workflows/other.yml" } },
    { ageHours: 25, run: { head_branch: "untrusted-branch" } },
    { ageHours: 25, run: { head_repository: { full_name: "other/repository" } } },
  ]);
  // A real artifact API timestamp may round an upload in the capture second down to whole seconds.
  fake.artifacts[0].created_at = new Date(Math.floor((now - 3600_000) / 1000) * 1000).toISOString();
  const result = await maintainOffsiteBackups({ master, api: fake.api, now });
  assert.equal(result.status, "verified");
  assert.equal(result.latestVerifiedBackup.runId, "100");
  assert.equal(result.expiredArtifactsRemoved, 1);
  assert.equal(result.preservedArtifacts, 4);
  assert.deepEqual(fake.deleted, [1001]);
});
await test("NFR-010: a failed restore, missing artifact or 18-hour stale verification never reports healthy", async () => {
  const master = randomBytes(32),
    now = Date.now();
  for (const cases of [[], [{ conclusion: "failure" }], [{ ageHours: 19 }], [{ ageHours: 25 }]]) {
    const fake = fakeGithub(master, now, cases);
    const result = await maintainOffsiteBackups({ master, api: fake.api, now });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "verified_offsite_backup_missing_or_stale");
    if (cases[0]?.ageHours === 19) assert.equal(result.latestVerifiedBackup.ageSeconds, 19 * 3600);
  }
  const fake = fakeGithub(master, now, [{ ageHours: 1, conclusion: "failure" }, { ageHours: 13 }]);
  assert.equal(
    (await maintainOffsiteBackups({ master, api: fake.api, now })).latestVerifiedBackup.runId,
    "101",
  );
});
await test("NFR-009/SEC-003: incomplete listing and unconfirmed deletion fail closed", async () => {
  const master = randomBytes(32),
    now = Date.now();
  await assert.rejects(
    maintainOffsiteBackups({ master, now, api: async () => ({ total_count: 1, artifacts: [] }) }),
  );
  const fake = fakeGithub(master, now, [{ ageHours: 25 }]);
  await assert.rejects(
    maintainOffsiteBackups({
      master,
      now,
      api: async (method, path) =>
        path.endsWith("/artifacts/1000") && method === "GET"
          ? { id: 1000 }
          : fake.api(method, path),
    }),
    /delete_not_confirmed/u,
  );
});
await test("SEC-007/NFR-009: GitHub adapter bounds payloads, prevents redirects and confines write endpoints", async () => {
  const calls = [];
  const api = githubBackupApi("private-token-marker", async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ total_count: 0, artifacts: [] }));
  });
  await api("GET", `/repos/${backupRepository}/actions/artifacts?per_page=100&page=1`);
  assert.equal(calls[0].url.origin, "https://api.github.com");
  assert.equal(calls[0].options.redirect, "error");
  await assert.rejects(api("DELETE", `/repos/${backupRepository}/actions/runs/1`));
  await assert.rejects(api("GET", `/repos/${backupRepository}/actions/../../secrets`));
  await assert.rejects(
    githubBackupApi(
      "private-token-marker",
      async () => new Response("private-raw-body", { status: 500 }),
    )("GET", `/repos/${backupRepository}/actions/artifacts`),
    /github_backup_operation_failed/u,
  );
  await assert.rejects(
    githubBackupApi(
      "private-token-marker",
      async () => new Response("x".repeat(4 * 1024 * 1024 + 1)),
    )("GET", `/repos/${backupRepository}/actions/artifacts`),
    /github_backup_response_invalid/u,
  );
});

async function removeOwned(directory) {
  assert.equal(dirname(directory), resolve(tmpdir()));
  await rm(directory, { recursive: true, force: true });
}
await test("SEC-007: bad online ciphertext is rejected before loopback target validation, preserving existing inputs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-offsite-guard-"));
  try {
    await writeFile(join(directory, offsiteFiles[0]), "invalid-private-marker");
    await writeFile(join(directory, offsiteFiles[1]), "invalid-private-marker");
    await assert.rejects(
      verifyOnlineBackup({
        environment: { DATABASE_URL: "postgresql://private:marker@source.invalid/source" },
        bundleDirectory: directory,
        master: randomBytes(32),
        expected: identity,
      }),
      /online_backup_unreadable_or_expired/u,
    );
    await assert.rejects(
      captureOnlineBackup({
        environment: { DATABASE_URL: "postgresql://private:marker@127.0.0.1:1/source" },
        bundleDirectory: directory,
        master: fixtureKey,
        identity: { ...identity, scope: "fixture" },
      }),
      (error) => error.code === "EEXIST",
    );
    assert.equal(
      await readFile(join(directory, offsiteFiles[0]), "utf8"),
      "invalid-private-marker",
    );
  } finally {
    await removeOwned(directory);
  }
});
await test(
  "NFR-010/SEC-003, FR-017/022: real online capture preserves source runtimes, reads retained reports and keeps copied claims quarantined",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "stacklens-offsite-database-"));
    const environment = {
      DATABASE_URL: requireLocalDatabase(process.env.TEST_DATABASE_URL).toString(),
    };
    const expected = { ...identity, scope: "fixture" },
      bundleDirectory = join(directory, "bundle");
    const admin = createStackLensPool(environment.DATABASE_URL, undefined, { max: 1 });
    const restoreNames = async () =>
      (
        await admin.query(
          "SELECT datname FROM pg_database WHERE datname LIKE 'stacklens_restore_%' ORDER BY datname",
        )
      ).rows;
    try {
      const before = await restoreNames();
      const capture = await captureOffsiteFixture({
        environment,
        bundleDirectory,
        identity: expected,
      });
      assert.equal(capture.sourceRuntimesAliveDuringCapture, true);
      assert.equal(capture.ownedSourceDatabaseRemoved, true);
      const verified = await verifyOnlineBackup({
        environment,
        bundleDirectory,
        master: fixtureKey,
        expected,
      });
      assert.equal(verified.matchingTables, 7);
      assert.equal(verified.archivedStrictReportReads, 2);
      assert.equal(verified.strictReportReads, 1);
      assert.equal(verified.apiReportReads, 1);
      assert.equal(verified.expiredTerminalRowsRemoved, 1);
      assert.equal(verified.populatedReportReadbackCovered, true);
      assert.deepEqual(verified.retainedReportHashes, [capture.fixtureRetainedReportHash]);
      assert.equal(verified.copiedQueueRows, 1);
      assert.equal(verified.liveClaimsUnlocked, false);
      assert.equal(verified.queueStarted, false);
      assert.equal(verified.ownedDatabaseRemoved, true);
      assert.deepEqual(await restoreNames(), before);
      const key = deriveArchiveKey(fixtureKey, expected);
      const { value, header } = authenticateOnlineBackup(
        await readFile(join(bundleDirectory, offsiteFiles[0])),
        await readFile(join(bundleDirectory, offsiteFiles[1])),
        fixtureKey,
        expected,
      );
      await unlink(join(bundleDirectory, offsiteFiles[1]));
      value.source["public.analysis"].count++;
      await sealOnlineMetadata(bundleDirectory, key, value, header);
      await assert.rejects(
        verifyOnlineBackup({ environment, bundleDirectory, master: fixtureKey, expected }),
        /online_backup_verification_failed/u,
      );
      assert.deepEqual(await restoreNames(), before);
      const emptyBundle = join(directory, "expired-reports");
      await captureOffsiteFixture({
        environment,
        bundleDirectory: emptyBundle,
        identity: expected,
        expireAllReports: true,
      });
      const empty = await verifyOnlineBackup({
        environment,
        bundleDirectory: emptyBundle,
        master: fixtureKey,
        expected,
      });
      assert.equal(empty.archivedStrictReportReads, 2);
      assert.equal(empty.strictReportReads, 0);
      assert.equal(empty.apiReportReads, 0);
      assert.equal(empty.populatedReportReadbackCovered, false);
      assert.equal(empty.expiredTerminalRowsRemoved, 2);
      assert.equal(empty.missingAnalysisApiReadback, true);
      assert.deepEqual(await restoreNames(), before);
    } finally {
      await admin.end();
      await removeOwned(directory);
    }
  },
);
