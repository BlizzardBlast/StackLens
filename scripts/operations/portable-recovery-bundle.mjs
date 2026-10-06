// SEC-003/007, NFR-009: only authenticated ciphertext crosses the runner boundary.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { decryptArchive, encryptArchive, maximumArchiveBytes } from "./backup-envelope.mjs";
import { readBoundedFile, sha256 } from "./common.mjs";

export const fixtureKey = Buffer.alloc(32, 0x53); // Public synthetic fixtures only.
export const bundleFiles = ["database.slbackup", "recovery.slmetadata"];
const tables = [
  "public.analysis",
  "public.analysis_report",
  "public.analysis_delivery",
  "graphile_worker._private_jobs",
  "graphile_worker._private_job_queues",
  "graphile_worker._private_tasks",
  "graphile_worker.migrations",
];
const exactKeys = (value, keys) =>
  assert.equal(Object.keys(value).toSorted().join(","), keys.toSorted().join(","));
const hash = (value) => assert.match(value, /^[0-9a-f]{64}$/u);
const uuid = (value) =>
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);

function validate(value, scope, runId) {
  exactKeys(value, [
    "version",
    "scope",
    "sourceCommit",
    "runId",
    "archiveSha256",
    "fingerprintAlgorithm",
    "source",
    "executor",
    "fixture",
  ]);
  assert.equal(value.version, 1);
  assert.equal(value.scope, scope);
  assert(["fixture", "preview"].includes(scope));
  assert.equal(value.runId, runId);
  assert.match(runId, /^[0-9]+$/u);
  assert.match(value.sourceCommit, /^[0-9a-f]{40}$/u);
  hash(value.archiveSha256);
  assert.equal(value.fingerprintAlgorithm, "postgres-jsonb-c-v1");
  exactKeys(value.source, tables);
  for (const item of Object.values(value.source)) {
    exactKeys(item, ["count", "sha256"]);
    assert(Number.isSafeInteger(item.count) && item.count >= 0);
    hash(item.sha256);
  }
  if (scope === "fixture") {
    exactKeys(value.executor, ["kind", "ownerId"]);
    assert.equal(value.executor.kind, "confirmed_child_exit");
    assert.match(value.executor.ownerId, /^pool-[0-9a-f]{18}$/u);
    exactKeys(value.fixture, [
      "completedId",
      "completedHash",
      "expiredId",
      "activeId",
      "queuedId",
      "outboxId",
    ]);
    hash(value.fixture.completedHash);
    for (const name of ["completedId", "expiredId", "activeId", "queuedId", "outboxId"])
      uuid(value.fixture[name]);
  } else {
    exactKeys(value.executor, ["kind"]);
    assert.equal(value.executor.kind, "operator_confirmed_offline_drained");
    assert.equal(value.fixture, null);
    assert.equal(value.source["graphile_worker._private_jobs"].count, 0);
  }
  return value;
}

export async function sealRecoveryMetadata(directory, key, value, snapshot) {
  validate(value, value.scope, value.runId);
  const header = { version: 1, createdAt: snapshot.createdAt, expiresAt: snapshot.expiresAt };
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, bundleFiles[1]),
    encryptArchive(Buffer.from(JSON.stringify(value)), key, header),
    { mode: 0o600, flag: "wx" },
  );
}

export function authenticateRecoveryBundle(archive, metadata, key, scope, runId, now = Date.now()) {
  try {
    if (scope === "preview") assert(!key.equals(fixtureKey));
    assert(metadata.length <= 64 * 1024);
    const decoded = decryptArchive(metadata, key, now);
    const value = validate(JSON.parse(decoded.archive.toString("utf8")), scope, runId);
    assert.equal(sha256(archive), value.archiveSha256);
    const backup = decryptArchive(archive, key, now);
    assert.deepEqual(decoded.metadata, backup.metadata);
    return { value, header: backup.metadata };
  } catch {
    throw new Error("recovery_bundle_unreadable_or_expired");
  }
}

export async function readRecoveryBundle(directory, key, scope, runId) {
  return authenticateRecoveryBundle(
    await readBoundedFile(resolve(directory, bundleFiles[0]), maximumArchiveBytes + 1024),
    await readBoundedFile(resolve(directory, bundleFiles[1]), 64 * 1024),
    key,
    scope,
    runId,
  );
}
