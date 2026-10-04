/* oxlint-disable no-await-in-loop -- One bounded Worker workload and its resource observations run at a time. */
// FR-003/017/021, NFR-008/009, SEC-001/002/007: analyze public inputs, never execute them.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import {
  cleanupSteps,
  command,
  pause,
  record,
  removePrivateFile,
  requireLocalDatabase,
  root,
  sourceIdentity,
  until,
} from "./common.mjs";

const original = requireLocalDatabase(process.env.TEST_DATABASE_URL ?? "");
const archive = resolve(process.argv[2] ?? "");
const count = Number(process.argv[3] ?? "8");
if (!Number.isInteger(count) || count < 2 || count > 12)
  throw new Error("soak_count_must_be_2_to_12");
const databaseName = `stacklens_soak_${randomUUID().replaceAll("-", "")}`;
const localUrl = new URL(original);
localUrl.pathname = `/${databaseName}`;
const containerUrl = new URL(localUrl);
containerUrl.hostname = "host.docker.internal";
const privateDirectory = resolve(root, ".cache/operations-private");
await mkdir(privateDirectory, { recursive: true });
const envFile = resolve(privateDirectory, `soak-${randomUUID()}.env`);
const admin = createStackLensPool(original.toString(), undefined, { max: 1 });
const evidence = {
  requirementIds: [
    "FR-003",
    "FR-017",
    "FR-021",
    "NFR-008",
    "NFR-009",
    "SEC-001",
    "SEC-002",
    "SEC-007",
  ],
  ...(await sourceIdentity()),
  scope: "Local Linux panel image with live providers and an isolated local database",
  memoryLimitBytes: 256 * 1024 * 1024,
  cpuLimit: 0.25,
  workerConcurrency: 1,
  requestedJobs: count,
  startedAt: new Date().toISOString(),
  jobs: [],
  status: "pending",
};
let created = false,
  container,
  api;
let phase = "initialization";
async function running() {
  const detail = JSON.parse((await command("docker", ["inspect", container])).stdout)[0];
  if (!detail.State.Running || detail.State.OOMKilled)
    throw new Error("constrained_worker_stopped");
}
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const token = process.env.STACKLENS_GITHUB_TOKEN ?? "";
  if (token.includes("\n") || token.includes("\r"))
    throw new Error("invalid_provider_configuration");
  await writeFile(
    envFile,
    `DATABASE_URL=${containerUrl}\nSTACKLENS_DATABASE_POOL_MAX=5\nSTACKLENS_WORKER_CONCURRENCY=1\nSTACKLENS_GITHUB_TOKEN=${token}\n`,
    { mode: 0o600 },
  );
  api = await createStackLensApiRuntime({
    connectionString: localUrl.toString(),
    databasePoolOptions: { max: 2 },
    logger: false,
  });
  container = (
    await command("docker", [
      "run",
      "--detach",
      "--memory",
      "256m",
      "--memory-swap",
      "256m",
      "--cpus",
      "0.25",
      "--mount",
      `type=bind,source=${archive},target=/artifact.tar.gz,readonly`,
      "--mount",
      `type=bind,source=${envFile},target=/private.env,readonly`,
      "--entrypoint",
      "bash",
      "ghcr.io/ptero-eggs/yolks:nodejs_24",
      "-c",
      "tar -xzf /artifact.tar.gz -C /home/container && cp /private.env /home/container/runtime.env && cd /home/container && /usr/local/bin/ts-node --esm start-worker.js",
    ])
  ).stdout.trim();
  await until(async () => {
    await running();
    return (await command("docker", ["logs", container])).stdout.includes(
      "StackLens queue owner started",
    );
  }, 90_000);
  for (let index = 0; index < count; index++) {
    phase = `job_${index + 1}`;
    const repositoryUrl =
      index % 2 === 0
        ? "https://github.com/BlizzardBlast/frey-ui"
        : "https://github.com/BlizzardBlast/KerjaLog";
    const started = Date.now();
    const submitted = await api.app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: { repositoryUrl },
    });
    assert.equal(submitted.statusCode, 202);
    const { analysisId } = submitted.json();
    let terminal;
    let progressAt = 0;
    while (Date.now() - started < 600_000) {
      await running();
      const response = await api.app.inject({ method: "GET", url: `/v1/analyses/${analysisId}` });
      assert.equal(response.statusCode, 200);
      const value = response.json();
      if (Date.now() - progressAt > 30_000) {
        process.stdout.write(
          `${JSON.stringify({ job: index + 1, repository: repositoryUrl.split("/").at(-1), status: value.status, stage: value.progressStage, elapsedMs: Date.now() - started })}\n`,
        );
        progressAt = Date.now();
      }
      if (["completed", "completed_with_limitations", "failed"].includes(value.status)) {
        terminal = value;
        break;
      }
      await pause(1_000);
    }
    assert(terminal, "analysis_deadline_exceeded");
    const memoryPeakBytes = Number(
      (
        await command("docker", ["exec", container, "cat", "/sys/fs/cgroup/memory.peak"])
      ).stdout.trim(),
    );
    const memoryEvents = Object.fromEntries(
      (await command("docker", ["exec", container, "cat", "/sys/fs/cgroup/memory.events"])).stdout
        .trim()
        .split("\n")
        .map((line) => {
          const [name, amount] = line.split(" ");
          return [name, Number(amount)];
        }),
    );
    evidence.jobs.push({
      index,
      repositoryUrl,
      analysisId,
      status: terminal.status,
      durationMs: Date.now() - started,
      commitSha: terminal.report?.input.repository?.commitSha ?? null,
      limitationCount: terminal.report?.limitations.length ?? null,
      providerFailureCodes: terminal.report?.partialFailures.map((failure) => failure.code) ?? [],
      failureCode: terminal.failure?.code ?? null,
      memoryPeakBytes,
      memoryEvents,
    });
    assert.notEqual(terminal.status, "failed");
    AnalysisReportSchema.parse(terminal.report);
    assert.equal(memoryEvents.oom, 0);
    assert.equal(memoryEvents.oom_kill, 0);
    assert.equal(memoryEvents.max, 0);
  }
  evidence.memoryPeakBytes = Math.max(...evidence.jobs.map((job) => job.memoryPeakBytes));
  evidence.status = "verified_bounded_live_provider_soak";
} catch (error) {
  evidence.status = "failed";
  evidence.failedPhase = phase;
  evidence.failureCode = [
    "operational_subprocess_timeout",
    "operational_subprocess_failed",
    "constrained_worker_stopped",
  ].includes(error.message)
    ? error.message
    : "soak_assertion_failed";
  process.exitCode = 1;
} finally {
  const steps = [];
  if (container)
    steps.push(
      [
        "observeWorker",
        async () => {
          const beforeStop = JSON.parse((await command("docker", ["inspect", container])).stdout)[0]
            .State;
          evidence.beforeStop = {
            running: beforeStop.Running,
            exitCode: beforeStop.ExitCode,
            oomKilled: beforeStop.OOMKilled,
          };
        },
      ],
      ["stopWorker", () => command("docker", ["stop", "--time", "20", container])],
      [
        "observeExit",
        async () => {
          const state = JSON.parse((await command("docker", ["inspect", container])).stdout)[0]
            .State;
          evidence.exitCode = state.ExitCode;
          evidence.oomKilled = state.OOMKilled;
        },
      ],
      ["removeWorker", () => command("docker", ["rm", container])],
    );
  steps.push(
    ["stopApi", () => api?.stop()],
    [
      "dropOwnedDatabase",
      () => (created ? admin.query(`DROP DATABASE "${databaseName}"`) : undefined),
    ],
    ["closeAdmin", () => admin.end()],
    ["removePrivateEnvironment", () => removePrivateFile(envFile)],
  );
  evidence.cleanupFailures = await cleanupSteps(steps);
  evidence.cleanedUp = evidence.cleanupFailures.length === 0;
  if (!evidence.cleanedUp) {
    evidence.status = "failed";
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[4] ?? ".cache/operations/worker-soak.json", evidence);
}
