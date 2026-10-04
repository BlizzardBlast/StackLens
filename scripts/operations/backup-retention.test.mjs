// SEC-003/007: expired archive deletion is authenticated and never removes a shared key.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { encryptArchive, maximumArchiveBytes } from "./backup-envelope.mjs";
import { expireBackup } from "./backup.mjs";

void test("SEC-003/007: deletion requires an authenticated expired archive and preserves the key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-backup-retention-"));
  const archivePath = join(directory, "backup.slbackup"),
    keyPath = join(directory, "backup.key");
  try {
    const key = randomBytes(32);
    const metadata = {
      version: 1,
      createdAt: "2026-10-03T00:00:00.000Z",
      expiresAt: "2026-10-04T00:00:00.000Z",
    };
    const archive = encryptArchive(Buffer.from("private fixture"), key, metadata);
    await writeFile(keyPath, key);
    await writeFile(archivePath, archive);
    await assert.rejects(
      expireBackup(archivePath, keyPath, Date.parse(metadata.createdAt)),
      /backup_not_expired/u,
    );
    assert.deepEqual(await readFile(archivePath), archive);
    const corrupt = Buffer.from(archive);
    corrupt[corrupt.length - 1] ^= 1;
    await writeFile(archivePath, corrupt);
    await assert.rejects(
      expireBackup(archivePath, keyPath, Date.parse(metadata.expiresAt)),
      /backup_unreadable_or_expired/u,
    );
    assert.deepEqual(await readFile(archivePath), corrupt);
    await writeFile(archivePath, archive);
    assert.equal(
      (await expireBackup(archivePath, keyPath, Date.parse(metadata.expiresAt))).archiveRemoved,
      true,
    );
    await assert.rejects(readFile(archivePath), (error) => error.code === "ENOENT");
    assert.deepEqual(await readFile(keyPath), key);
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

void test("SEC-003/007: oversized archives and keys are rejected before loading or deleting them", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-backup-bounds-"));
  const archivePath = join(directory, "backup.slbackup"),
    keyPath = join(directory, "backup.key");
  try {
    await writeFile(archivePath, Buffer.alloc(0));
    await truncate(archivePath, maximumArchiveBytes + 1_025);
    await writeFile(keyPath, randomBytes(32));
    await assert.rejects(expireBackup(archivePath, keyPath), /operational_file_limit_exceeded/u);
    await writeFile(archivePath, Buffer.from("fixture"));
    await writeFile(keyPath, randomBytes(33));
    await assert.rejects(expireBackup(archivePath, keyPath), /operational_file_limit_exceeded/u);
    assert.deepEqual(await readFile(archivePath), Buffer.from("fixture"));
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
