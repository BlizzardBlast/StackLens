/* oxlint-disable no-await-in-loop -- Each owned Linux lifecycle rehearsal is sequential and bounded. */
// FR-003/021, NFR-008/009, SEC-001/002/007: exercise trusted Worker code, never repository execution.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "../../packages/persistence/dist/index.js";
import {
  command,
  record,
  readBoundedFile,
  removePrivateFile,
  requireLocalDatabase,
  root,
  sha256,
  sourceIdentity,
  until,
} from "./common.mjs";
import { settleCapacitySteps } from "./worker-capacity-evidence.mjs";
import { capacityCommitSha, capacityRepositoryUrl } from "./worker-capacity-fixtures.mjs";

const configured = requireLocalDatabase(process.env.TEST_DATABASE_URL ?? "");
const archive = resolve(process.argv[2] ?? "");
// Match the observed Node egg, including its quoted glob and ts-node parent.
const startup =
  'if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ "${MAIN_FILE}" == "*.js" ]]; then /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}; else /usr/local/bin/ts-node --esm "/home/container/${MAIN_FILE}" ${NODE_ARGS}; fi';
const evidence = {
  requirementIds: ["FR-003", "FR-021", "NFR-008", "NFR-009", "SEC-001", "SEC-002", "SEC-007"],
  ...(await sourceIdentity()),
  lifecycleHashes: Object.fromEntries(
    await Promise.all(
      [
        "apps/worker/src/main.ts",
        "apps/worker/src/shutdown.ts",
        "scripts/operations/worker-lifecycle.mjs",
        "scripts/operations/worker-lifecycle-fetch.mjs",
        "scripts/operations/worker-capacity-fixtures.mjs",
      ].map(async (path) => [
        path,
        sha256(await readBoundedFile(resolve(root, path), 1024 * 1024)),
      ]),
    ),
  ),
  archiveSha256: sha256(await readBoundedFile(archive, 150 * 1024 * 1024)),
  startupSha256: sha256(startup),
  scope:
    "Owned local Linux panel launch with synthetic providers, 256 MiB/no swap/0.25 CPU; not hosted outage evidence",
  startedAt: new Date().toISOString(),
  cases: [],
  status: "pending",
};
const admin = createStackLensPool(configured.toString(), undefined, { max: 1 });
let failed = false;
try {
  for (const [scenario, signal, launch] of [
    ["idle", "SIGINT", "panel"],
    ["idle", "SIGTERM", "native"],
    ["disconnected", "SIGINT", "panel"],
    ["interrupted", "SIGINT", "panel"],
    ["interrupted", "SIGTERM", "native"],
    ["ancestor_termination", "SIGTERM", "panel"],
  ]) {
    const database = `stacklens_lifecycle_${randomUUID().replaceAll("-", "")}`;
    const localUrl = new URL(configured);
    localUrl.pathname = `/${database}`;
    const containerUrl = new URL(localUrl);
    containerUrl.hostname = "host.docker.internal";
    const privateDirectory = resolve(root, ".cache/operations-private");
    await mkdir(privateDirectory, { recursive: true });
    const environment = resolve(privateDirectory, `lifecycle-${randomUUID()}.env`);
    const releaseMarker = `${environment}.release`;
    const observer = createStackLensPool(localUrl.toString(), undefined, { max: 1 });
    const repository = new DrizzleAnalysisRepository(createStackLensDatabase(observer));
    const result = { scenario, signal, launch, status: "pending" };
    let created = false,
      container;
    let phase = "startup";
    try {
      await admin.query(`CREATE DATABASE "${database}"`);
      created = true;
      await writeFile(
        environment,
        `DATABASE_URL=${containerUrl}\nSTACKLENS_DATABASE_POOL_MAX=5\nSTACKLENS_WORKER_CONCURRENCY=1\nSTACKLENS_LIFECYCLE_SCENARIO=${scenario}\n`,
        { mode: 0o600 },
      );
      container = (
        await command("docker", [
          "run",
          "--detach",
          "--interactive",
          "--tty",
          "--memory",
          "256m",
          "--memory-swap",
          "256m",
          "--cpus",
          "0.25",
          "--mount",
          `type=bind,source=${archive},target=/artifact.tar.gz,readonly`,
          "--mount",
          `type=bind,source=${environment},target=/private.env,readonly`,
          ...["worker-lifecycle-fetch.mjs", "worker-capacity-fixtures.mjs"].flatMap((name) => [
            "--mount",
            `type=bind,source=${resolve(root, "scripts/operations", name)},target=/home/container/${name},readonly`,
          ]),
          "-e",
          `STARTUP=${startup}`,
          "-e",
          "MAIN_FILE=start-worker.js",
          "-e",
          "NODE_OPTIONS=--import=/home/container/worker-lifecycle-fetch.mjs",
          "ghcr.io/ptero-eggs/yolks:nodejs_24",
          "bash",
          "-c",
          `tar -xzf /artifact.tar.gz -C /home/container && cp /private.env /home/container/runtime.env && ${launch === "panel" ? "exec /entrypoint.sh" : "exec /usr/local/bin/node --max-old-space-size=96 ./start-worker.js"}`,
        ])
      ).stdout.trim();
      await until(async () => {
        const state = JSON.parse(
          (await command("docker", ["inspect", container, "--format", "{{json .State}}"])).stdout,
        );
        assert(state.Running, "lifecycle_worker_exited_during_startup");
        return (await command("docker", ["logs", container])).stdout.includes(
          "StackLens queue owner started",
        );
      }, 90_000);
      phase = "signal";
      if (["interrupted", "ancestor_termination"].includes(scenario)) {
        phase = "interruption";
        await repository.createQueuedRepositoryAnalysis({
          id: "lifecycle-retry",
          repositoryUrl: capacityRepositoryUrl,
          createdAt: new Date().toISOString(),
        });
        await until(
          async () => (await repository.findAnalysis("lifecycle-retry"))?.status === "running",
          30_000,
        );
      }
      if (scenario === "disconnected") {
        await observer.end();
        await admin.query(`ALTER DATABASE "${database}" WITH ALLOW_CONNECTIONS false`);
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1",
          [database],
        );
      }
      const stoppingAt = Date.now();
      await command("docker", ["kill", "--signal", signal, container]);
      await until(
        async () =>
          !JSON.parse(
            (await command("docker", ["inspect", container, "--format", "{{json .State}}"])).stdout,
          ).Running,
        30_000,
      );
      result.stopMs = Date.now() - stoppingAt;
      const state = JSON.parse(
        (await command("docker", ["inspect", container, "--format", "{{json .State}}"])).stdout,
      );
      result.exitCode = state.ExitCode;
      result.oomKilled = state.OOMKilled;
      assert.equal(state.OOMKilled, false);
      const logs = (await command("docker", ["logs", container])).stdout;
      if (scenario === "ancestor_termination") {
        assert.equal(state.ExitCode, 143);
        assert(!logs.includes("StackLens Worker shutdown completed."));
        assert.equal(await repository.findReport("lifecycle-retry"), undefined);
        assert.equal(
          (
            await observer.query(
              "SELECT count(*)::int AS locks FROM graphile_worker._private_jobs WHERE locked_by IS NOT NULL",
            )
          ).rows[0].locks,
          1,
        );
        result.status = "verified_ancestor_termination_limitation";
        continue;
      }
      assert(logs.includes(`"signal":"${signal}"`));
      assert.equal(state.ExitCode, 0);
      assert(logs.includes("StackLens Worker shutdown completed."));
      result.shutdown = logs
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('{"event":"stacklens_worker_shutdown",'))
        .map((line) => JSON.parse(line));
      assert.equal(result.shutdown.filter((event) => event.state === "completed").length, 5);
      if (scenario === "interrupted") {
        phase = "replay";
        const pending = await repository.findAnalysis("lifecycle-retry");
        assert.equal(pending.status, "queued");
        assert.equal(pending.failureSummary.code, "repository_analysis_interrupted");
        assert.equal(await repository.findReport("lifecycle-retry"), undefined);
        assert.equal(
          (
            await observer.query(
              "SELECT count(*)::int AS locks FROM graphile_worker._private_jobs WHERE locked_by IS NOT NULL",
            )
          ).rows[0].locks,
          0,
        );
        // Release the fixture before restart; a fast native startup must not race marker creation.
        await writeFile(releaseMarker, "", { mode: 0o600 });
        await command("docker", ["cp", releaseMarker, `${container}:/tmp/release-fixture`]);
        await command("docker", ["start", container]);
        await until(
          async () =>
            (await repository.findAnalysis("lifecycle-retry"))?.status.startsWith("completed"),
          90_000,
        );
        const report = await repository.findReport("lifecycle-retry");
        AnalysisReportSchema.parse(report.report);
        assert.equal(report.report.input.repository.commitSha, capacityCommitSha);
        assert.equal(report.report.partialFailures.length, 0);
        result.reportSha256 = sha256(JSON.stringify(report.report));
        await until(
          async () =>
            (
              await observer.query(
                "SELECT count(*)::int AS jobs FROM graphile_worker._private_jobs",
              )
            ).rows[0].jobs === 0,
        );
        await command("docker", ["kill", "--signal", signal, container]);
        await until(
          async () =>
            !JSON.parse(
              (await command("docker", ["inspect", container, "--format", "{{json .State}}"]))
                .stdout,
            ).Running,
          30_000,
        );
        const restartedState = JSON.parse(
          (await command("docker", ["inspect", container, "--format", "{{json .State}}"])).stdout,
        );
        result.restartExitCode = restartedState.ExitCode;
        assert.equal(restartedState.ExitCode, 0);
        assert.equal(restartedState.OOMKilled, false);
        const restartedLogs = (await command("docker", ["logs", container])).stdout;
        assert.equal(restartedLogs.split("StackLens Worker shutdown completed.").length - 1, 2);
        assert.equal(
          sha256(JSON.stringify((await repository.findReport("lifecycle-retry")).report)),
          result.reportSha256,
        );
        result.sameAnalysisRecovered = true;
      }
      result.status = "verified";
    } catch {
      failed = true;
      result.status = "failed";
      result.failureCode = "worker_lifecycle_assertion_or_deadline";
      result.failedPhase = phase;
      if (container)
        await writeFile(
          resolve(root, `.cache/operations/lifecycle-${scenario}-${signal}.log`),
          (await command("docker", ["logs", container])).stdout,
        );
    } finally {
      Object.assign(
        result,
        await settleCapacitySteps([
          [
            "removeOwnedWorker",
            () => (container ? command("docker", ["rm", "--force", container]) : undefined),
          ],
          ["closeObserver", () => (scenario === "disconnected" ? undefined : observer.end())],
          [
            "dropOwnedDatabase",
            () => (created ? admin.query(`DROP DATABASE "${database}" WITH (FORCE)`) : undefined),
          ],
          ["removePrivateEnvironment", () => removePrivateFile(environment)],
          ["removeReleaseMarker", () => removePrivateFile(releaseMarker)],
        ]),
      );
      if (!result.cleanedUp) failed = true;
      evidence.cases.push(result);
      process.stdout.write(
        `${JSON.stringify({ scenario, signal, status: result.status, stopMs: result.stopMs })}\n`,
      );
    }
  }
} finally {
  await admin.end();
  evidence.status = failed ? "failed" : "verified_bounded_linux_lifecycle";
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[3] ?? ".cache/operations/worker-lifecycle.json", evidence);
  if (failed) process.exitCode = 1;
}
