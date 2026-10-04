/* oxlint-disable no-await-in-loop -- One bounded Worker workload and its resource observations run at a time. */
// FR-003/017/021, NFR-008/009, SEC-001/002/007: analyze public inputs, never execute them.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "../../packages/persistence/dist/index.js";
import {
  command,
  pause,
  record,
  removePrivateFile,
  requireLocalDatabase,
  root,
  sourceIdentity,
  readBoundedFile,
  sha256,
  until,
} from "./common.mjs";
import { settleCapacitySteps } from "./worker-capacity-evidence.mjs";
import {
  capacityRepositoryUrl,
  capacityPackageCount,
  capacityResponseBytes,
  workloadOptions,
} from "./worker-capacity-fixtures.mjs";

const original = requireLocalDatabase(process.env.TEST_DATABASE_URL ?? "");
const archive = resolve(process.argv[2] ?? "");
const count = Number(process.argv[3] ?? "8");
const workload = workloadOptions(process.argv[5], process.argv[6], process.argv[7]);
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
const observer = createStackLensPool(localUrl.toString(), undefined, { max: 1 });
const repository = new DrizzleAnalysisRepository(createStackLensDatabase(observer));
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
  harnessHashes: Object.fromEntries(
    await Promise.all(
      [
        "worker-soak.mjs",
        "worker-capacity-process.mjs",
        "worker-capacity-fixtures.mjs",
        "worker-capacity-evidence.mjs",
      ].map(async (name) => [
        name,
        sha256(await readBoundedFile(resolve(root, "scripts/operations", name), 1024 * 1024)),
      ]),
    ),
  ),
  archiveSha256: sha256(await readBoundedFile(archive, 150 * 1024 * 1024)),
  scope: `Local Linux panel image with ${workload.providers} providers and an isolated local database`,
  memoryLimitBytes: 256 * 1024 * 1024,
  cpuLimit: 0.25,
  workerConcurrency: workload.concurrency,
  workloadMode: workload.mode,
  ...(workload.providers === "synthetic"
    ? {
        fixture: {
          packageCount: capacityPackageCount,
          responseBytes: capacityResponseBytes,
          transportChunkBytes: 16 * 1024,
        },
      }
    : {}),
  requestedJobs: count,
  startedAt: new Date().toISOString(),
  jobs: [],
  databaseSamples: [],
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
async function submit(index) {
  const repositoryUrl =
    workload.providers === "synthetic"
      ? capacityRepositoryUrl
      : index % 2 === 0
        ? "https://github.com/BlizzardBlast/frey-ui"
        : "https://github.com/BlizzardBlast/KerjaLog";
  const submitted = await api.app.inject({
    method: "POST",
    url: "/v1/analyses/repository",
    payload: { repositoryUrl },
  });
  assert.equal(submitted.statusCode, 202);
  return { index, repositoryUrl, analysisId: submitted.json().analysisId, observedAt: Date.now() };
}
async function waitForJob(job) {
  let terminal;
  let progressAt = 0;
  while (Date.now() - job.observedAt < 600_000) {
    await running();
    const response = await api.app.inject({ method: "GET", url: `/v1/analyses/${job.analysisId}` });
    assert.equal(response.statusCode, 200);
    const value = response.json();
    const { rows } = await observer.query(
      "SELECT (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database()) AS clients, (SELECT count(*)::int FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction') AS idle_transactions, count(*) FILTER (WHERE status='queued')::int AS queued, count(*) FILTER (WHERE status='running')::int AS running FROM analysis",
    );
    evidence.databaseSamples.push({ at: new Date().toISOString(), ...rows[0] });
    if (Date.now() - progressAt > 30_000) {
      process.stdout.write(
        `${JSON.stringify({ job: job.index + 1, status: value.status, stage: value.progressStage, elapsedMs: Date.now() - job.observedAt })}\n`,
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
  const stored = await repository.findAnalysis(job.analysisId);
  evidence.jobs.push({
    index: job.index,
    repositoryUrl: job.repositoryUrl,
    analysisId: job.analysisId,
    status: terminal.status,
    queueDelayMs: stored.startedAt
      ? Date.parse(stored.startedAt) - Date.parse(stored.createdAt)
      : null,
    executionMs:
      stored.startedAt && stored.completedAt
        ? Date.parse(stored.completedAt) - Date.parse(stored.startedAt)
        : null,
    durationMs: stored.completedAt
      ? Date.parse(stored.completedAt) - Date.parse(stored.createdAt)
      : null,
    commitSha: terminal.report?.input.repository?.commitSha ?? null,
    limitationCount: terminal.report?.limitations.length ?? null,
    providerFailureCodes: terminal.report?.partialFailures.map((failure) => failure.code) ?? [],
    failureCode: terminal.failure?.code ?? null,
    ...(terminal.report
      ? {
          outcomeHash: sha256(
            JSON.stringify({
              facts: terminal.report.facts,
              findings: terminal.report.findings,
              recommendations: terminal.report.recommendations,
              scores: terminal.report.scores,
              limitations: terminal.report.limitations,
            }),
          ),
        }
      : {}),
  });
  assert.notEqual(terminal.status, "failed");
  AnalysisReportSchema.parse(terminal.report);
  if (workload.providers === "synthetic") assert.equal(terminal.report.partialFailures.length, 0);
}
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const token = process.env.STACKLENS_GITHUB_TOKEN ?? "";
  if (token.includes("\n") || token.includes("\r"))
    throw new Error("invalid_provider_configuration");
  await writeFile(
    envFile,
    `DATABASE_URL=${containerUrl}\nSTACKLENS_DATABASE_POOL_MAX=5\nSTACKLENS_WORKER_CONCURRENCY=${workload.concurrency}\nSTACKLENS_GITHUB_TOKEN=${workload.providers === "live" ? token : ""}\nSTACKLENS_SOAK_MODE=${workload.mode}\nSTACKLENS_SOAK_PROVIDERS=${workload.providers}\n`,
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
      "--mount",
      `type=bind,source=${resolve(root, "scripts/operations/worker-capacity-process.mjs")},target=/capacity-process.mjs,readonly`,
      "--mount",
      `type=bind,source=${resolve(root, "scripts/operations/worker-capacity-fixtures.mjs")},target=/capacity-fixtures.mjs,readonly`,
      "--entrypoint",
      "bash",
      "ghcr.io/ptero-eggs/yolks:nodejs_24",
      "-c",
      "tar -xzf /artifact.tar.gz -C /home/container && cp /capacity-process.mjs /home/container/worker-capacity-process.mjs && cp /capacity-fixtures.mjs /home/container/worker-capacity-fixtures.mjs && cd /home/container && node --max-old-space-size=96 worker-capacity-process.mjs",
    ])
  ).stdout.trim();
  await until(async () => {
    await running();
    return (await command("docker", ["logs", container])).stdout.includes(
      "StackLens queue owner started",
    );
  }, 90_000);
  phase = workload.mode;
  if (workload.mode === "burst") {
    const submissions = await Promise.allSettled(
      Array.from({ length: count }, (_, index) => submit(index)),
    );
    assert(
      submissions.every((result) => result.status === "fulfilled"),
      "burst_submission_failed",
    );
    const submitted = submissions.map((result) => result.value);
    // Wait for every monitor before cleanup, even when one job fails.
    const results = await Promise.allSettled(submitted.map(waitForJob));
    assert(
      results.every((result) => result.status === "fulfilled"),
      "burst_job_failed",
    );
  } else if (workload.mode === "sustained") {
    // Three producers replenish a bounded outstanding window until the count is exhausted.
    let next = 0;
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(3, count) }, async () => {
        while (next < count) {
          const index = next++;
          await waitForJob(await submit(index));
        }
      }),
    );
    assert(
      results.every((result) => result.status === "fulfilled"),
      "sustained_job_failed",
    );
  } else {
    for (let index = 0; index < count; index++) await waitForJob(await submit(index));
  }
  assert.equal(evidence.jobs.length, count);
  const { rows } = await observer.query(
    "SELECT count(*)::int AS terminal, count(*) FILTER (WHERE status IN ('queued','running'))::int AS pending FROM analysis",
  );
  assert.equal(rows[0].terminal, count);
  assert.equal(rows[0].pending, 0);
  evidence.peakDatabaseClients = Math.max(
    ...evidence.databaseSamples.map((sample) => sample.clients),
  );
  evidence.peakQueuedJobs = Math.max(...evidence.databaseSamples.map((sample) => sample.queued));
  evidence.jobs = evidence.jobs.toSorted((left, right) => left.index - right.index);
  if (workload.providers === "synthetic")
    assert.equal(new Set(evidence.jobs.map((job) => job.outcomeHash)).size, 1);
  evidence.status = `verified_bounded_${workload.providers}_${workload.mode}_soak`;
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
        "observation",
      ],
      ["stopWorker", () => command("docker", ["stop", "--time", "20", container])],
      [
        "observeExit",
        async () => {
          const state = JSON.parse((await command("docker", ["inspect", container])).stdout)[0]
            .State;
          evidence.exitCode = state.ExitCode;
          evidence.oomKilled = state.OOMKilled;
          const observations = (await command("docker", ["logs", container])).stdout
            .split("\n")
            .filter((line) => line.startsWith('{"event":"stacklens_worker_capacity"'))
            .map((line) => JSON.parse(line));
          assert.equal(observations.length, 1);
          const observation = observations[0];
          evidence.resourceProfiles = observation.profiles;
          evidence.memoryPeakBytes = observation.memoryPeakBytes;
          evidence.memoryEvents = observation.memoryEvents;
          assert.equal(observation.sampleFailed, false);
          assert.equal(state.ExitCode, 0);
          assert.equal(state.OOMKilled, false);
          assert.equal(observation.memoryEvents.oom, 0);
          assert.equal(observation.memoryEvents.oom_kill, 0);
          assert.equal(observation.memoryEvents.max, 0);
        },
        "observation",
      ],
      ["removeWorker", () => command("docker", ["rm", container])],
    );
  steps.push(
    ["stopApi", () => api?.stop()],
    ["closeObserver", () => observer.end()],
    [
      "dropOwnedDatabase",
      () => (created ? admin.query(`DROP DATABASE "${databaseName}"`) : undefined),
    ],
    ["closeAdmin", () => admin.end()],
    ["removePrivateEnvironment", () => removePrivateFile(envFile)],
  );
  Object.assign(evidence, await settleCapacitySteps(steps));
  if (evidence.observationFailures.length > 0 || !evidence.cleanedUp) {
    evidence.status = "failed";
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[4] ?? ".cache/operations/worker-soak.json", evidence);
}
