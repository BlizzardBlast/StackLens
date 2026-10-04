// SEC-003/007: hosted restore cannot weaken loopback guards or contact an unapproved endpoint.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { rootCertificates } from "node:tls";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { encryptArchive } from "./backup-envelope.mjs";
import { requireNeonRestoreTarget, restoreBackup, restoreNeonBackup } from "./backup.mjs";
import { requireLocalDatabase } from "./common.mjs";

const hostname = "ep-fixture.c-4.ap-southeast-1.aws.neon.tech";
const environment = {
  DATABASE_URL: `postgresql://fixture:private-marker@${hostname}/fixture`,
  STACKLENS_DATABASE_SSL_CA: rootCertificates[0],
};
const rejectsPrivately = (error) =>
  error.message === "invalid_neon_restore_target" &&
  !error.stack.includes("private-marker") &&
  error.cause === undefined;

void test("SEC-007: remote restore requires the exact approved direct Neon endpoint and verified TLS", () => {
  assert.equal(requireNeonRestoreTarget(environment, hostname).hostname, hostname);
  assert.throws(() => requireNeonRestoreTarget(environment), rejectsPrivately);
  assert.throws(
    () => requireNeonRestoreTarget(environment, "ep-other.aws.neon.tech"),
    rejectsPrivately,
  );
  for (const host of [
    "127.0.0.1",
    "database.example",
    "ep-fixture-pooler.c-4.ap-southeast-1.aws.neon.tech",
    "ep-fixture.aws.neon.tech.attacker.example",
  ]) {
    const url = new URL(environment.DATABASE_URL);
    url.hostname = host;
    assert.throws(
      () => requireNeonRestoreTarget({ ...environment, DATABASE_URL: url.toString() }, host),
      rejectsPrivately,
    );
  }
  for (const suffix of ["?sslmode=require", "?host=attacker.example", "#fragment"]) {
    assert.throws(
      () =>
        requireNeonRestoreTarget(
          { ...environment, DATABASE_URL: environment.DATABASE_URL + suffix },
          hostname,
        ),
      rejectsPrivately,
    );
  }
  const port = new URL(environment.DATABASE_URL);
  port.port = "1234";
  assert.throws(
    () => requireNeonRestoreTarget({ ...environment, DATABASE_URL: port.toString() }, hostname),
    rejectsPrivately,
  );
  assert.throws(
    () => requireNeonRestoreTarget({ DATABASE_URL: environment.DATABASE_URL }, hostname),
    rejectsPrivately,
  );
  assert.throws(
    () => requireNeonRestoreTarget({ ...environment, DATABASE_URL: "private-marker" }, hostname),
    rejectsPrivately,
  );
});

void test(
  "SEC-003/007: failed PostgreSQL restore removes its owned database and all transient private files",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = requireLocalDatabase(process.env.TEST_DATABASE_URL);
    const directory = await mkdtemp(join(tmpdir(), "stacklens-failed-restore-"));
    const archivePath = join(directory, "backup.slbackup"),
      keyPath = join(directory, "backup.key");
    const admin = createStackLensPool(url.toString(), undefined, { max: 1 });
    const databases = async () =>
      (
        await admin.query(
          "SELECT datname FROM pg_database WHERE datname LIKE 'stacklens_restore_%' ORDER BY datname",
        )
      ).rows;
    try {
      const before = await databases();
      const now = Date.now(),
        key = randomBytes(32);
      await writeFile(keyPath, key);
      await writeFile(
        archivePath,
        encryptArchive(Buffer.from("invalid PostgreSQL custom archive"), key, {
          version: 1,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 60_000).toISOString(),
        }),
      );
      await assert.rejects(
        restoreBackup({ DATABASE_URL: url.toString() }, archivePath, keyPath, directory),
        /operational_subprocess_failed/u,
      );
      assert.deepEqual(await databases(), before);
      assert.deepEqual((await readdir(directory)).toSorted(), ["backup.key", "backup.slbackup"]);
      assert.equal(
        (await admin.query("SELECT current_database() AS name")).rows[0].name,
        decodeURIComponent(url.pathname.slice(1)),
      );
    } finally {
      await admin.end();
      assert.equal(dirname(directory), resolve(tmpdir()));
      await rm(directory, { recursive: true, force: true });
    }
  },
);

void test("SEC-003/007: expired and corrupt hosted archives fail before any network or database mutation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-neon-restore-"));
  const archivePath = join(directory, "backup.slbackup"),
    keyPath = join(directory, "backup.key");
  try {
    const key = randomBytes(32);
    const archive = encryptArchive(Buffer.from("private fixture"), key, {
      version: 1,
      createdAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-01-02T00:00:00.000Z",
    });
    await writeFile(keyPath, key);
    await writeFile(archivePath, archive);
    await assert.rejects(
      restoreNeonBackup(environment, archivePath, keyPath, directory, hostname),
      /backup_unreadable_or_expired/u,
    );
    const corrupt = Buffer.from(archive);
    corrupt[corrupt.length - 1] ^= 1;
    await writeFile(archivePath, corrupt);
    await assert.rejects(
      restoreNeonBackup(environment, archivePath, keyPath, directory, hostname),
      /backup_unreadable_or_expired/u,
    );
    await assert.rejects(
      restoreBackup(environment, archivePath, keyPath, directory),
      /local_rehearsal_requires_loopback_database/u,
    );
    const privateOutput = join(directory, "restored.json");
    await assert.rejects(
      restoreNeonBackup(environment, archivePath, keyPath, directory, hostname, privateOutput),
      /backup_unreadable_or_expired/u,
    );
    await assert.rejects(readFile(privateOutput), (error) => error.code === "ENOENT");
    await writeFile(privateOutput, "existing private configuration");
    await assert.rejects(
      restoreNeonBackup(environment, archivePath, keyPath, directory, hostname, privateOutput),
      (error) => error.code === "EEXIST",
    );
    assert.equal(await readFile(privateOutput, "utf8"), "existing private configuration");
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
