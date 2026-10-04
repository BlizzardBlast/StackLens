/* oxlint-disable no-await-in-loop -- Staircase and idle observations must complete in order. */
// NFR-008/009, SEC-007: read-only, bounded observations of the existing personal API.
import assert from "node:assert/strict";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { pause, readPrivateConfiguration, record } from "./common.mjs";

const environment = await readPrivateConfiguration(process.argv[2]);
if (!/^[a-f0-9]{40}$/iu.test(process.argv[3] ?? ""))
  throw new Error("verified_deployed_commit_required");
const pool = createStackLensPool(environment.DATABASE_URL, undefined, {
  max: 1,
  sslCa: environment.STACKLENS_DATABASE_SSL_CA.replaceAll("\\n", "\n"),
  applicationName: "stacklens-release-observer",
});
const evidence = {
  requirementIds: ["NFR-008", "NFR-009", "SEC-007"],
  target: "https://stacklens-api.vercel.app",
  deployedCommit: process.argv[3],
  startedAt: new Date().toISOString(),
  status: "pending",
  requests: [],
  samples: [],
  limitations: [
    "Idle/resume observations alone do not prove platform suspension.",
    "Sampled concurrency does not prove the autoscaling topology.",
  ],
};
let client,
  sampling,
  samplingError,
  phase = "baseline";
const samplingState = { stopped: false };
async function sample() {
  const { rows } = await client.query(
    "SELECT count(*)::int AS clients, count(*) FILTER (WHERE usename = current_user)::int AS shared_role_clients, count(*) FILTER (WHERE application_name = 'stacklens-api-vercel-single-use')::int AS api_clients, count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_transactions FROM pg_stat_activity WHERE backend_type = 'client backend'",
  );
  evidence.samples.push({ phase, at: new Date().toISOString(), ...rows[0] });
  if (rows[0].clients >= evidence.normalConnectionSlots - 2)
    throw new Error("connection_budget_stop");
}
async function request(index) {
  if (samplingError) throw samplingError;
  const started = Date.now();
  const response = await fetch(
    `${evidence.target}/v1/analyses/529183ea-88c8-4fc2-9ab9-a38f52e889ea`,
    { signal: AbortSignal.timeout(20_000), headers: { "Cache-Control": "no-cache" } },
  );
  const body = await response.json();
  evidence.requests.push({
    index,
    phase,
    status: response.status,
    durationMs: Date.now() - started,
  });
  assert.equal(response.status, 404);
  assert.equal(body.code, "analysis_not_found");
  assert.match(response.headers.get("cache-control"), /no-store/);
}
try {
  client = await pool.connect();
  const settings = (
    await client.query(
      "SELECT current_setting('max_connections')::int AS maximum, current_setting('superuser_reserved_connections')::int + coalesce(current_setting('reserved_connections', true)::int, 0) AS reserved, (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS role_limit",
    )
  ).rows[0];
  evidence.maxConnections = settings.maximum;
  evidence.reservedConnections = settings.reserved;
  evidence.sharedRoleLimit = settings.role_limit;
  evidence.normalConnectionSlots = settings.maximum - settings.reserved;
  sampling = (async () => {
    while (!samplingState.stopped) {
      await sample();
      await pause(phase.includes("idle") ? 1_000 : 100);
    }
  })().catch((error) => {
    samplingError = error;
  });
  await pause(2_000);
  let index = 0;
  for (const concurrency of [1, 2, 4]) {
    phase = `burst_${concurrency}`;
    await Promise.all(Array.from({ length: concurrency }, () => request(index++)));
  }
  phase = "idle";
  await pause(35_000);
  if (samplingError) throw samplingError;
  assert.equal(evidence.samples.at(-1).api_clients, 0);
  phase = "resume";
  await Promise.all([request(index++), request(index++)]);
  phase = "final_idle";
  await pause(35_000);
  if (samplingError) throw samplingError;
  assert.equal(evidence.samples.at(-1).api_clients, 0);
  assert.equal(evidence.samples.at(-1).idle_transactions, 0);
  evidence.peakClients = Math.max(...evidence.samples.map((item) => item.clients));
  evidence.peakApiClients = Math.max(...evidence.samples.map((item) => item.api_clients));
  evidence.finalApiClients = evidence.samples.at(-1).api_clients;
  evidence.status = "verified_bounded_hosted_burst_idle_resume";
} catch {
  evidence.status = "failed";
  process.exitCode = 1;
} finally {
  samplingState.stopped = true;
  await sampling;
  client?.release();
  await pool.end();
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[4] ?? ".cache/operations/hosted-connections.json", evidence);
}
