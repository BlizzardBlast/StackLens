/* oxlint-disable no-await-in-loop -- Measurement phases, startup and shutdown must be ordered. */
// FR-003/004/022, NFR-008/009, SEC-003/007: local process freeze and concurrent cold initialization.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import {
  cleanupSteps,
  command,
  pause,
  record,
  requireLocalDatabase,
  root,
  sourceIdentity,
  until,
} from "./common.mjs";

const original = requireLocalDatabase(process.env.TEST_DATABASE_URL ?? "");
const image = process.argv[2];
if (!image?.startsWith("stacklens-api:")) throw new Error("reviewed_api_image_required");
const databaseName = `stacklens_lifecycle_${randomUUID().replaceAll("-", "")}`;
const isolated = new URL(original);
isolated.pathname = `/${databaseName}`;
const containerUrl = new URL(isolated);
containerUrl.hostname = "host.docker.internal";
const admin = createStackLensPool(original.toString(), undefined, { max: 1 });
const observer = createStackLensPool(isolated.toString(), undefined, {
  max: 1,
  applicationName: "stacklens-lifecycle-observer",
});
const evidence = {
  requirementIds: ["FR-003", "FR-004", "FR-022", "NFR-008", "NFR-009", "SEC-003", "SEC-007"],
  ...(await sourceIdentity()),
  scope: "Local Docker/Linux process simulation; not Vercel suspension or autoscaling proof",
  startedAt: new Date().toISOString(),
  instances: [],
  samples: [],
  status: "pending",
};
const containers = [];
let created = false;
let paused;
const samplingState = { stopped: false };
let sampling;
let sampleError;
let phase = "initialization";
async function sample() {
  const { rows } = await observer.query(
    "SELECT count(*)::int AS clients, count(*) FILTER (WHERE application_name = 'stacklens-api-vercel-single-use')::int AS api_clients, count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_transactions FROM pg_stat_activity WHERE datname = current_database()",
  );
  evidence.samples.push({ at: new Date().toISOString(), phase, ...rows[0] });
}
async function lookup(origin, id = "529183ea-88c8-4fc2-9ab9-a38f52e889ea") {
  const response = await fetch(`${origin}/v1/analyses/${id}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.status, id === "529183ea-88c8-4fc2-9ab9-a38f52e889ea" ? 404 : 200);
  assert(!JSON.stringify(body).includes("stacklens:stacklens"));
  return body;
}
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  sampling = (async () => {
    while (!samplingState.stopped) {
      await sample();
      await pause(100);
    }
  })().catch((error) => {
    sampleError = error;
  });
  for (let index = 0; index < 3; index++) {
    const started = Date.now();
    const { stdout } = await command("docker", [
      "run",
      "--detach",
      "--publish",
      "127.0.0.1::3000",
      "--env",
      `DATABASE_URL=${containerUrl}`,
      "--env",
      `VERCEL_GIT_COMMIT_SHA=${evidence.baseCommit}`,
      "--mount",
      `type=bind,source=${resolve(root, "scripts/operations/api-process.mjs")},target=/app/operations-host.mjs,readonly`,
      "--entrypoint",
      "node",
      image,
      "/app/operations-host.mjs",
    ]);
    const id = stdout.trim();
    containers.push(id);
    const port = (await command("docker", ["port", id, "3000"])).stdout.trim().split(":").at(-1);
    const origin = `http://127.0.0.1:${port}`;
    await until(async () => {
      try {
        return (
          (await fetch(`${origin}/openapi.json`, { signal: AbortSignal.timeout(500) })).status ===
          200
        );
      } catch {
        return false;
      }
    });
    evidence.instances.push({ index, startupMs: Date.now() - started, origin });
  }
  const origins = evidence.instances.map((item) => item.origin);
  phase = "requests";
  const submission = await fetch(`${origins[0]}/v1/analyses/repository`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repositoryUrl: "https://github.com/acme/lifecycle-fixture" }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(submission.status, 202);
  const { analysisId } = await submission.json();
  const requests = await Promise.all(
    Array.from({ length: 24 }, (_, index) => lookup(origins[index % origins.length], analysisId)),
  );
  assert(requests.every((item) => item.status === "queued"));
  evidence.concurrentLookups = requests.length;
  phase = "idle";
  await until(async () => {
    await sample();
    return evidence.samples.at(-1).api_clients === 0;
  });
  paused = containers[0];
  phase = "freeze_resume";
  await command("docker", ["pause", paused]);
  const started = Date.now();
  const resumedRequest = lookup(origins[0]);
  // Attach a handler immediately so a failed request cannot escape cleanup as an unhandled rejection.
  const observedRequest = resumedRequest.then(
    (value) => ({ value }),
    () => ({ failed: true }),
  );
  await pause(1_500);
  await command("docker", ["unpause", paused]);
  paused = undefined;
  assert(!(await observedRequest).failed);
  evidence.freezeResumeRequestMs = Date.now() - started;
  await lookup(origins[0], analysisId);
  phase = "final_idle";
  await until(async () => {
    await sample();
    return evidence.samples.at(-1).api_clients === 0;
  });
  evidence.finalApiClients = evidence.samples.at(-1).api_clients;
  evidence.peakApiClients = Math.max(...evidence.samples.map((item) => item.api_clients));
  assert(evidence.peakApiClients <= containers.length);
  assert.equal(evidence.samples.at(-1).idle_transactions, 0);
  evidence.runtimeInitializations = [];
  for (const id of containers) {
    const logs = (await command("docker", ["logs", id])).stdout
      .split("\n")
      .filter((line) => line.startsWith('{"event":"stacklens_api_runtime_ready"'))
      .map((line) => JSON.parse(line));
    assert.equal(logs.length, 1);
    evidence.runtimeInitializations.push(...logs);
  }
  if (sampleError) throw sampleError;
  evidence.status = "verified_local_cold_instances_and_freeze_resume";
} catch (error) {
  evidence.status = "failed";
  evidence.failureCode =
    error.code === "ERR_ASSERTION" ? "assertion_failed" : "operational_check_failed";
  evidence.failedPhase = phase;
  process.exitCode = 1;
} finally {
  samplingState.stopped = true;
  const steps = [["stopSampling", () => sampling]];
  if (paused) steps.push(["unpauseApi", () => command("docker", ["unpause", paused])]);
  for (const [index, id] of containers.entries()) {
    steps.push(
      [`stopApi${index}`, () => command("docker", ["stop", "--time", "15", id])],
      [`removeApi${index}`, () => command("docker", ["rm", "--force", id])],
    );
  }
  steps.push(
    ["closeObserver", () => observer.end()],
    [
      "dropOwnedDatabase",
      () => (created ? admin.query(`DROP DATABASE "${databaseName}"`) : undefined),
    ],
    ["closeAdmin", () => admin.end()],
  );
  evidence.cleanupFailures = await cleanupSteps(steps);
  evidence.cleanedUp = evidence.cleanupFailures.length === 0;
  if (!evidence.cleanedUp) {
    evidence.status = "failed";
    process.exitCode = 1;
  }
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[3] ?? ".cache/operations/api-lifecycle.json", evidence);
}
