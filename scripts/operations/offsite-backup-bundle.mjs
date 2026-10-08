// NFR-010, SEC-003/007: online snapshots are authenticated, expiring and never proof of executor death.
import assert from "node:assert/strict";
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { decryptArchive, encryptArchive, maximumArchiveBytes } from "./backup-envelope.mjs";
import { readBoundedFile, sha256 } from "./common.mjs";
import { fixtureKey } from "./portable-recovery-bundle.mjs";

export const offsiteFiles = ["database.slbackup", "online.slmetadata"];
export const backupRepository = "BlizzardBlast/StackLens";
export const backupWorkflowPath = ".github/workflows/offsite-preview-backups.yml";
export const backupVerificationJob = "verify offsite backup";
export const maximumVerifiedBackupAgeMs = 18 * 60 * 60 * 1000;
const lifetime = 24 * 60 * 60 * 1000;
const tables = [
  "public.analysis",
  "public.analysis_report",
  "public.analysis_delivery",
  "graphile_worker._private_jobs",
  "graphile_worker._private_job_queues",
  "graphile_worker._private_tasks",
  "graphile_worker.migrations",
];
const exactKeys = (value, keys) => {
  assert(value && typeof value === "object" && !Array.isArray(value));
  assert.equal(Object.keys(value).toSorted().join(","), keys.toSorted().join(","));
};
function identity(value) {
  assert.equal(value.repository, backupRepository);
  assert.match(value.runId, /^[0-9]{1,20}$/u);
  assert.match(value.sourceCommit, /^[0-9a-f]{40}$/u);
  assert(["preview", "fixture"].includes(value.scope));
}
export function validateBackupMaster(key, scope) {
  assert(Buffer.isBuffer(key) && key.length === 32);
  assert(["preview", "fixture"].includes(scope));
  if (scope === "preview") assert(!key.equals(fixtureKey));
}
export function deriveArchiveKey(master, value) {
  identity(value);
  validateBackupMaster(master, value.scope);
  return Buffer.from(
    hkdfSync(
      "sha256",
      master,
      Buffer.alloc(0),
      Buffer.from(
        JSON.stringify([
          "stacklens-online-backup-v1",
          value.scope,
          value.repository,
          value.runId,
          value.sourceCommit,
        ]),
      ),
      32,
    ),
  );
}
function validateManifest(value, expected) {
  exactKeys(value, [
    "version",
    "purpose",
    "repository",
    "runId",
    "sourceCommit",
    "scope",
    "archiveSha256",
    "fingerprintAlgorithm",
    "source",
  ]);
  identity(value);
  assert.equal(value.version, 1);
  assert.equal(value.purpose, "online-backup");
  for (const name of ["repository", "runId", "sourceCommit", "scope"])
    assert.equal(value[name], expected[name]);
  assert.match(value.archiveSha256, /^[0-9a-f]{64}$/u);
  assert.equal(value.fingerprintAlgorithm, "postgres-jsonb-c-v1");
  exactKeys(value.source, tables);
  for (const item of Object.values(value.source)) {
    exactKeys(item, ["count", "sha256"]);
    assert(Number.isSafeInteger(item.count) && item.count >= 0);
    assert.match(item.sha256, /^[0-9a-f]{64}$/u);
  }
  return value;
}
export async function sealOnlineMetadata(directory, key, value, snapshot) {
  validateManifest(value, value);
  await writeFile(
    resolve(directory, offsiteFiles[1]),
    encryptArchive(Buffer.from(JSON.stringify(value)), key, {
      version: 1,
      createdAt: snapshot.createdAt,
      expiresAt: snapshot.expiresAt,
    }),
    { mode: 0o600, flag: "wx" },
  );
}
export function authenticateOnlineBackup(archive, metadata, master, expected, now = Date.now()) {
  try {
    assert(metadata.length <= 64 * 1024);
    const key = deriveArchiveKey(master, expected);
    const decoded = decryptArchive(metadata, key, now);
    const value = validateManifest(JSON.parse(decoded.archive.toString("utf8")), expected);
    assert.equal(sha256(archive), value.archiveSha256);
    const backup = decryptArchive(archive, key, now);
    assert.deepEqual(decoded.metadata, backup.metadata);
    return { value, header: backup.metadata, key };
  } catch {
    throw new Error("online_backup_unreadable_or_expired");
  }
}
export async function readOnlineBackup(directory, master, expected, now = Date.now()) {
  return authenticateOnlineBackup(
    await readBoundedFile(resolve(directory, offsiteFiles[0]), maximumArchiveBytes + 1024),
    await readBoundedFile(resolve(directory, offsiteFiles[1]), 64 * 1024),
    master,
    expected,
    now,
  );
}
function labelMac(master, parts, scope) {
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      master,
      Buffer.alloc(0),
      Buffer.from("stacklens-offsite-retention-label-v1"),
      32,
    ),
  );
  return createHmac("sha256", key)
    .update(JSON.stringify([backupRepository, scope, ...parts]))
    .digest("hex");
}
export function retentionLabel(master, value, header) {
  validateBackupMaster(master, value.scope);
  identity(value);
  const parts = [
    value.runId,
    value.sourceCommit,
    String(Date.parse(header.createdAt)),
    String(Date.parse(header.expiresAt)),
    value.archiveSha256,
  ];
  const name = `${value.scope}-offsite-v1-${parts.join("-")}-${labelMac(master, parts, value.scope)}`;
  authenticateRetentionLabel(master, name, value.scope);
  return name;
}
export function authenticateRetentionLabel(master, name, scope = "preview") {
  try {
    validateBackupMaster(master, scope);
    assert(name.startsWith(`${scope}-offsite-v1-`));
    const match =
      /^(?:preview|fixture)-offsite-v1-([0-9]{1,20})-([0-9a-f]{40})-([0-9]{13})-([0-9]{13})-([0-9a-f]{64})-([0-9a-f]{64})$/u.exec(
        name,
      );
    assert(match);
    const [, runId, sourceCommit, created, expires, archiveSha256, mac] = match;
    const createdAt = Number(created),
      expiresAt = Number(expires);
    assert(expiresAt > createdAt && expiresAt - createdAt <= lifetime);
    assert(
      timingSafeEqual(
        Buffer.from(mac, "hex"),
        Buffer.from(
          labelMac(master, [runId, sourceCommit, created, expires, archiveSha256], scope),
          "hex",
        ),
      ),
    );
    return { runId, sourceCommit, createdAt, expiresAt, archiveSha256 };
  } catch {
    throw new Error("unmanaged_or_unauthenticated_backup_artifact");
  }
}
