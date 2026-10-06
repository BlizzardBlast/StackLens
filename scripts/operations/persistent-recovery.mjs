// NFR-008/009, SEC-003/007: authenticated persistent staging; never starts compute or changes routing.
import assert from "node:assert/strict";
import { mkdir, open, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { requireNeonRestoreTarget, restoreBackup, restoreNeonBackup } from "./backup.mjs";
import {
  readBoundedFile,
  readPrivateConfiguration,
  removePrivateFile,
  requireLocalDatabase,
  root,
  sha256,
} from "./common.mjs";
import { bundleFiles, readRecoveryBundle } from "./portable-recovery-bundle.mjs";

export async function stagePersistentRecovery({
  environment,
  bundleDirectory,
  keyPath,
  privateDirectory,
  sourceRunId,
  privateOutput,
  target,
}) {
  assert(privateOutput, "private_configuration_output_required");
  const parent = await realpath(dirname(resolve(privateOutput)));
  const inside = relative(await realpath(root), parent);
  assert(
    isAbsolute(inside) || inside === ".." || inside.startsWith(`..${sep}`),
    "private_configuration_must_stay_outside_repository",
  );
  privateOutput = resolve(parent, basename(privateOutput));
  if (target?.kind === "neon") requireNeonRestoreTarget(environment, target.hostname);
  else if (target?.kind === "local") requireLocalDatabase(environment.DATABASE_URL);
  else throw new Error("invalid_persistent_recovery_target");
  const key = await readBoundedFile(keyPath, 32);
  // Scope, source run, archive identity and equal authenticated deadlines precede all target I/O.
  const { value, header } = await readRecoveryBundle(bundleDirectory, key, "preview", sourceRunId);
  const destination = await open(privateOutput, "wx", 0o600);
  let saved = false,
    verified;
  const verify = async (result) => {
    assert.deepEqual(result.restoredSnapshot, value.source, "recovery_snapshot_mismatch");
    assert.deepEqual(result.metadata, header, "recovery_header_mismatch");
    assert.equal(result.queueStarted, false);
    const pool = createStackLensPool(result.connectionString, undefined, {
      max: 1,
      ...(environment.STACKLENS_DATABASE_SSL_CA
        ? { sslCa: environment.STACKLENS_DATABASE_SSL_CA.replaceAll("\\n", "\n") }
        : {}),
    });
    try {
      const counts = (
        await pool.query(
          "SELECT (SELECT count(*) FROM analysis WHERE status IN ('queued','running'))::int AS in_flight, (SELECT count(*) FROM graphile_worker._private_jobs)::int AS jobs, (SELECT count(*) FROM analysis_delivery WHERE delivered_at IS NULL)::int AS pending",
        )
      ).rows[0];
      assert.deepEqual(
        counts,
        { in_flight: 0, jobs: 0, pending: 0 },
        "persistent_recovery_requires_drained_snapshot",
      );
      const reports = (await pool.query("SELECT report FROM analysis_report ORDER BY analysis_id"))
        .rows;
      const historicalReportHashes = reports.map((row) => {
        AnalysisReportSchema.parse(row.report);
        return sha256(JSON.stringify(row.report));
      });
      verified = { historicalReportHashes, retainedReports: reports.length, drained: true };
    } finally {
      await pool.end();
    }
    // No usable configuration is published until fingerprint, quarantine and strict-reader gates pass.
    assert(Date.now() < Date.parse(header.expiresAt), "recovery_expired_before_publication");
    await destination.writeFile(
      JSON.stringify({ ...environment, DATABASE_URL: result.connectionString }),
    );
    saved = true;
  };
  try {
    const args = [environment, resolve(bundleDirectory, bundleFiles[0]), keyPath, privateDirectory];
    const result =
      target.kind === "neon"
        ? await restoreNeonBackup(...args, target.hostname, undefined, verify, value.archiveSha256)
        : await restoreBackup(...args, verify, value.archiveSha256);
    return {
      status: "verified_persistent_target_quarantined",
      scope: "preview",
      target: target.kind,
      sourceRunId,
      sourceCommit: value.sourceCommit,
      backup: {
        createdAt: header.createdAt,
        expiresAt: header.expiresAt,
        archiveSha256: value.archiveSha256,
      },
      snapshotHashesMatched: true,
      tableFingerprintCount: Object.keys(value.source).length,
      expiredTerminalRowsRemoved: result.expiredTerminalRowsRemoved,
      ...verified,
      originalResourcesContacted: false,
      queueStarted: false,
      liveClaimsUnlocked: false,
      publicRoutingChanged: false,
      persistentDatabaseRetained: true,
      temporaryPrivateFilesCleanedUp: true,
    };
  } finally {
    try {
      await destination.close();
    } finally {
      if (!saved) await removePrivateFile(privateOutput);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [
    action,
    configuration,
    bundleDirectory,
    keyPath,
    sourceRunId,
    hostname,
    privateOutput,
    evidencePath,
  ] = process.argv.slice(2);
  let evidenceFile;
  try {
    assert(["stage-local", "stage-neon"].includes(action));
    assert(evidencePath && privateOutput);
    assert.notEqual(resolve(evidencePath), resolve(privateOutput));
    await mkdir(dirname(resolve(evidencePath)), { recursive: true });
    evidenceFile = await open(evidencePath, "wx", 0o600);
    await readBoundedFile(configuration, 16 * 1024);
    const environment = await readPrivateConfiguration(configuration);
    const result = await stagePersistentRecovery({
      environment,
      bundleDirectory,
      keyPath,
      privateDirectory: resolve(".cache/operations-private"),
      sourceRunId,
      privateOutput,
      target: action === "stage-neon" ? { kind: "neon", hostname } : { kind: "local" },
    });
    await evidenceFile.writeFile(
      JSON.stringify(
        {
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
          ...result,
        },
        null,
        2,
      ) + "\n",
    );
    process.stdout.write(
      JSON.stringify({ status: result.status, output: resolve(evidencePath) }) + "\n",
    );
  } catch {
    if (evidenceFile)
      await evidenceFile
        .writeFile(
          JSON.stringify({
            status: "failed",
            failureCode: "persistent_recovery_staging_failed",
            targetRemainsQuarantined: true,
          }) + "\n",
        )
        .catch(() => undefined);
    process.stderr.write(
      "Persistent recovery staging failed; keep any saved private target configuration for operator cleanup. Private details omitted.\n",
    );
    process.exitCode = 1;
  } finally {
    await evidenceFile?.close();
  }
}
