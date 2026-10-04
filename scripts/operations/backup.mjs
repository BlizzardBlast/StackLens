/* oxlint-disable no-await-in-loop -- Fingerprints share a single consistent snapshot client; report reads stay bounded. */
// FR-003/017, NFR-008/009, SEC-003/007: explicit operator tooling, never an analyzer execution path.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "../../packages/persistence/dist/index.js";
import { decryptArchive, encryptArchive, maximumArchiveBytes } from "./backup-envelope.mjs";
import {
  command,
  readBoundedFile,
  readPrivateConfiguration,
  record,
  removePrivateFile,
  requireLocalDatabase,
  sha256,
} from "./common.mjs";

const tables = [
  "public.analysis",
  "public.analysis_report",
  "public.analysis_delivery",
  "graphile_worker._private_jobs",
  "graphile_worker._private_job_queues",
  "graphile_worker._private_tasks",
  "graphile_worker.migrations",
];
export const fingerprintAlgorithm = "postgres-jsonb-c-v1";
export async function fingerprint(connection) {
  // Database defaults differ across providers. Fix timestamp rendering and bytewise row ordering.
  await connection.query("SET TIME ZONE 'UTC'");
  const result = {};
  let bytes = 0;
  for (const table of tables) {
    bytes += Number(
      (
        await connection.query(
          `SELECT coalesce(sum(octet_length(to_jsonb(t)::text)), 0) AS bytes FROM ${table} t`,
        )
      ).rows[0].bytes,
    );
    if (bytes > maximumArchiveBytes) throw new Error("backup_fingerprint_limit_exceeded");
    const rows = (
      await connection.query(
        `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text COLLATE "C"`,
      )
    ).rows.map((item) => item.row);
    result[table] = { count: rows.length, sha256: sha256(JSON.stringify(rows)) };
  }
  return result;
}
export async function expireBackup(archivePath, keyPath, now = Date.now()) {
  // Authenticate the header even after its restore window has expired.
  const { metadata } = decryptArchive(
    await readBoundedFile(archivePath, maximumArchiveBytes + 1_024),
    await readBoundedFile(keyPath, 32),
    0,
  );
  if (Date.parse(metadata.expiresAt) > now) throw new Error("backup_not_expired");
  await unlink(archivePath);
  return { metadata, archiveRemoved: true, keyRemoved: false };
}
function databaseOptions(environment) {
  const url = new URL(environment.DATABASE_URL);
  const sslCa = environment.STACKLENS_DATABASE_SSL_CA?.replaceAll("\\n", "\n");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !sslCa)
    throw new Error("remote_backup_requires_verified_ca");
  return { max: 1, ...(sslCa === undefined ? {} : { sslCa }) };
}
async function privateClientFiles(environment, directory, databaseName) {
  const url = new URL(environment.DATABASE_URL),
    options = databaseOptions(environment);
  await mkdir(directory, { recursive: true });
  const suffix = randomUUID(),
    envFile = resolve(directory, `${suffix}.env`),
    caFile = resolve(directory, `${suffix}.pem`);
  const containerName = `stacklens-backup-client-${suffix}`;
  const host = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ? "host.docker.internal"
    : url.hostname;
  const values = {
    PGHOST: host,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: databaseName,
    PGSSLMODE: options.sslCa ? "verify-full" : "disable",
    ...(options.sslCa ? { PGSSLROOTCERT: "/private-ca.pem" } : {}),
  };
  if (Object.values(values).some((value) => /[\r\n]/u.test(value)))
    throw new Error("invalid_postgresql_client_configuration");
  try {
    await writeFile(
      envFile,
      Object.entries(values)
        .map(([name, value]) => `${name}=${value}\n`)
        .join(""),
      { mode: 0o600 },
    );
    if (options.sslCa) await writeFile(caFile, options.sslCa, { mode: 0o600 });
  } catch (error) {
    await Promise.all([envFile, caFile].map((path) => unlink(path).catch(() => undefined)));
    throw error;
  }
  return {
    args: [
      "run",
      "--rm",
      "--name",
      containerName,
      "--read-only",
      "--tmpfs",
      "/tmp",
      "--env-file",
      envFile,
      ...(options.sslCa
        ? ["--mount", `type=bind,source=${caFile},target=/private-ca.pem,readonly`]
        : []),
    ],
    async cleanup() {
      await command("docker", ["rm", "--force", containerName]).catch(() => undefined);
      await Promise.all([
        removePrivateFile(envFile),
        ...(options.sslCa ? [removePrivateFile(caFile)] : []),
      ]);
    },
  };
}
export async function createBackup(environment, archivePath, keyPath, privateDirectory) {
  const original = new URL(environment.DATABASE_URL);
  const pool = createStackLensPool(original.toString(), undefined, databaseOptions(environment));
  let client, files;
  try {
    const key = await readBoundedFile(keyPath, 32);
    if (key.length !== 32) throw new Error("invalid_backup_key");
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await client.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
    const source = await fingerprint(client);
    files = await privateClientFiles(
      environment,
      privateDirectory,
      decodeURIComponent(original.pathname.slice(1)),
    );
    const dump = await command(
      "docker",
      [
        ...files.args,
        "postgres:18-alpine",
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--schema=public",
        "--schema=graphile_worker",
        `--snapshot=${snapshot}`,
      ],
      { encoding: "buffer", maxBuffer: maximumArchiveBytes },
    );
    if (dump.stderr.length) throw new Error("postgresql_backup_diagnostics");
    const createdAt = new Date().toISOString(),
      expiresAt = new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1_000).toISOString();
    const encrypted = encryptArchive(dump.stdout, key, { version: 1, createdAt, expiresAt });
    await mkdir(dirname(resolve(archivePath)), { recursive: true });
    await writeFile(archivePath, encrypted, { mode: 0o600, flag: "wx" });
    await client.query("COMMIT");
    return {
      source,
      fingerprintAlgorithm,
      createdAt,
      expiresAt,
      encryptedBytes: encrypted.length,
      encryptedSha256: sha256(encrypted),
    };
  } finally {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    try {
      await pool.end();
    } finally {
      await files?.cleanup();
    }
  }
}
export async function restoreBackup(environment, archivePath, keyPath, privateDirectory) {
  const original = requireLocalDatabase(environment.DATABASE_URL);
  return restoreFreshDatabase(environment, original, archivePath, keyPath, privateDirectory);
}

// Remote restoration is an explicit, separately guarded operator action. Local tools stay local.
export function requireNeonRestoreTarget(environment, expectedHostname) {
  let url;
  try {
    url = new URL(environment.DATABASE_URL);
  } catch {
    throw new Error("invalid_neon_restore_target");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    typeof expectedHostname !== "string" ||
    url.hostname !== expectedHostname ||
    !/^ep-[a-z0-9-]+\.(?:c-[0-9]+\.)?[a-z0-9-]+\.aws\.neon\.tech$/u.test(url.hostname) ||
    url.hostname.split(".")[0].endsWith("-pooler") ||
    !url.username ||
    !url.password ||
    !url.pathname.slice(1) ||
    (url.port && url.port !== "5432") ||
    url.hash ||
    [...url.searchParams.keys()].length ||
    !environment.STACKLENS_DATABASE_SSL_CA
  )
    throw new Error("invalid_neon_restore_target");
  return url;
}

export async function restoreNeonBackup(
  environment,
  archivePath,
  keyPath,
  privateDirectory,
  expectedHostname,
  privateOutput,
) {
  const original = requireNeonRestoreTarget(environment, expectedHostname);
  if (privateOutput === undefined)
    return restoreFreshDatabase(environment, original, archivePath, keyPath, privateDirectory);
  // Reserve the output exclusively before creating a database; never overwrite an existing login.
  const destination = await open(privateOutput, "wx", 0o600);
  let saved = false;
  try {
    return await restoreFreshDatabase(
      environment,
      original,
      archivePath,
      keyPath,
      privateDirectory,
      async (result) => {
        await destination.writeFile(
          JSON.stringify({ ...environment, DATABASE_URL: result.connectionString }),
        );
        saved = true;
      },
    );
  } finally {
    try {
      await destination.close();
    } finally {
      if (!saved) await removePrivateFile(privateOutput);
    }
  }
}

async function restoreFreshDatabase(
  environment,
  original,
  archivePath,
  keyPath,
  privateDirectory,
  onRestored,
) {
  // Authenticate and check expiry before any target mutation.
  const { archive, metadata } = decryptArchive(
    await readBoundedFile(archivePath, maximumArchiveBytes + 1_024),
    await readBoundedFile(keyPath, 32),
  );
  const databaseName = `stacklens_restore_${randomUUID().replaceAll("-", "")}`;
  const restoredUrl = new URL(original);
  restoredUrl.pathname = `/${databaseName}`;
  const options = databaseOptions(environment);
  const admin = createStackLensPool(original.toString(), undefined, options);
  let created = false,
    restored,
    files,
    dumpPath,
    result,
    failure;
  try {
    const version = Number(
      (await admin.query("SHOW server_version_num")).rows[0].server_version_num,
    );
    if (version < 180000 || version >= 190000) throw new Error("restore_requires_postgresql_18");
    await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`);
    created = true;
    restored = createStackLensPool(restoredUrl.toString(), undefined, options);
    if ((await restored.query("SELECT current_database() AS name")).rows[0].name !== databaseName)
      throw new Error("restore_target_identity_mismatch");
    const objects = (
      await restored.query(
        "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'",
      )
    ).rows[0].count;
    if (objects !== 0) throw new Error("restore_target_not_empty");
    await restored.query("DROP SCHEMA public");
    files = await privateClientFiles(environment, privateDirectory, databaseName);
    dumpPath = resolve(privateDirectory, `${randomUUID()}.dump`);
    await writeFile(dumpPath, archive, { mode: 0o600, flag: "wx" });
    await command("docker", [
      ...files.args,
      "--mount",
      `type=bind,source=${dumpPath},target=/private.dump,readonly`,
      "postgres:18-alpine",
      "pg_restore",
      `--dbname=${databaseName}`,
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "/private.dump",
    ]);
    const restoredSnapshot = await fingerprint(restored);
    const repository = new DrizzleAnalysisRepository(createStackLensDatabase(restored));
    const ids = (await restored.query("SELECT analysis_id FROM analysis_report")).rows.map(
      (row) => row.analysis_id,
    );
    for (const id of ids)
      if (!(await repository.findReport(id))) throw new Error("restored_report_unreadable");
    // Keep the queue quarantined. Expired terminal records cannot be exposed by a later API.
    const now = new Date().toISOString();
    let expiredTerminalRowsRemoved = 0,
      removed;
    do {
      removed = await repository.purgeExpiredTerminalAnalyses(now, 1_000);
      expiredTerminalRowsRemoved += removed;
    } while (removed === 1_000);
    result = {
      connectionString: restoredUrl.toString(),
      databaseName,
      restoredSnapshot,
      fingerprintAlgorithm,
      expiredTerminalRowsRemoved,
      reportsRead: ids.length,
      metadata,
      queueStarted: false,
    };
    await onRestored?.(result);
  } catch (error) {
    failure = error;
    try {
      await restored?.end();
    } catch {
      failure = new Error("backup_pool_cleanup_failed");
    } finally {
      restored = undefined;
    }
    if (created) {
      try {
        await admin.query(`DROP DATABASE "${databaseName}"`);
      } catch {
        failure = new Error("backup_database_cleanup_failed");
      }
    }
  } finally {
    const cleanups = await Promise.allSettled([
      restored?.end(),
      admin.end(),
      files?.cleanup(),
      ...(dumpPath ? [removePrivateFile(dumpPath)] : []),
    ]);
    if (cleanups.some((cleanup) => cleanup.status === "rejected"))
      failure ??= new Error("backup_cleanup_failed");
  }
  if (failure) throw failure;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [
    action,
    configuration,
    archivePath,
    keyPath,
    evidencePath,
    expectedHostname,
    privateOutput,
  ] = process.argv.slice(2);
  try {
    if (action === "init-key") {
      await mkdir(dirname(resolve(configuration)), { recursive: true });
      await writeFile(configuration, randomBytes(32), { mode: 0o600, flag: "wx" });
      process.stdout.write("Backup key created; keep it separate from encrypted archives.\n");
    } else if (action === "expire") {
      const result = await expireBackup(configuration, archivePath);
      await record(keyPath, {
        requirementIds: ["SEC-003", "SEC-007"],
        status: "expired_archive_removed",
        ...result,
      });
    } else {
      const environment = await readPrivateConfiguration(configuration);
      const privateDirectory = resolve(".cache/operations-private");
      const result =
        action === "create"
          ? await createBackup(environment, archivePath, keyPath, privateDirectory)
          : action === "restore"
            ? await restoreBackup(environment, archivePath, keyPath, privateDirectory)
            : action === "restore-neon" && privateOutput
              ? await restoreNeonBackup(
                  environment,
                  archivePath,
                  keyPath,
                  privateDirectory,
                  expectedHostname,
                  privateOutput,
                )
              : (() => {
                  throw new Error("unknown_backup_action");
                })();
      const { connectionString: _privateConnection, ...publicResult } = result;
      await record(evidencePath, {
        requirementIds: ["FR-003", "FR-017", "NFR-008", "NFR-009", "SEC-003", "SEC-007"],
        status: "verified",
        action,
        ...publicResult,
      });
    }
  } catch {
    process.stderr.write(
      "Backup operation failed without exposing configuration or archive content.\n",
    );
    process.exitCode = 1;
  }
}
