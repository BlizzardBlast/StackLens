// NFR-008/009, SEC-007: explicit, reversible operator configuration; no session termination.
import assert from "node:assert/strict";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { readPrivateConfiguration, record } from "./common.mjs";

const [mode, configuration, requested, output] = process.argv.slice(2);
const limit = Number(requested);
assert(["plan", "apply"].includes(mode), "connection_budget_mode_required");
assert(Number.isInteger(limit) && limit > 0, "positive_connection_budget_required");
const environment = await readPrivateConfiguration(configuration);
assert(environment.STACKLENS_DATABASE_SSL_CA, "verified_ca_required");
const pool = createStackLensPool(environment.DATABASE_URL, undefined, {
  max: 1,
  sslCa: environment.STACKLENS_DATABASE_SSL_CA.replaceAll("\\n", "\n"),
});
try {
  const limits = (
    await pool.query(
      "SELECT current_setting('max_connections')::int AS maximum, current_setting('superuser_reserved_connections')::int AS superuser_reserved, current_setting('reserved_connections')::int AS reserved, rolconnlimit AS previous, rolsuper AS superuser FROM pg_roles WHERE rolname = current_user",
    )
  ).rows[0];
  assert.equal(limits.superuser, false, "superuser_connection_limit_is_not_enforced");
  const normalSlots = limits.maximum - limits.superuser_reserved - limits.reserved;
  assert(limit <= normalSlots - 3, "three_normal_slots_of_headroom_required");
  const clients = Number(
    (
      await pool.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE backend_type = 'client backend' AND usename = current_user",
      )
    ).rows[0].count,
  );
  assert(clients < limit, "existing_clients_leave_no_budget_headroom");
  if (mode === "apply") {
    const sql = (
      await pool.query(
        "SELECT format('ALTER ROLE %I CONNECTION LIMIT %s', current_user, $1::integer) AS statement",
        [limit],
      )
    ).rows[0].statement;
    await pool.query(sql);
  }
  const observed = (
    await pool.query("SELECT rolconnlimit AS limit FROM pg_roles WHERE rolname = current_user")
  ).rows[0].limit;
  assert.equal(observed, mode === "apply" ? limit : limits.previous);
  await record(output, {
    requirementIds: ["NFR-008", "NFR-009", "SEC-007"],
    status: mode === "apply" ? "applied_and_verified" : "reviewable_plan",
    at: new Date().toISOString(),
    mode,
    serverMaximum: limits.maximum,
    normalSlots,
    previousRoleLimit: limits.previous,
    requestedRoleLimit: limit,
    observedRoleLimit: observed,
    observedRoleClients: clients,
    sessionsTerminated: 0,
    limitations: [
      "Shared API and Worker role; no exclusive Worker reservation.",
      "PostgreSQL describes role connection limits as approximately enforced; this is an overload guard, not an exact autoscaling bound.",
    ],
  });
} catch (error) {
  await record(output, {
    requirementIds: ["NFR-008", "NFR-009", "SEC-007"],
    status: "failed",
    mode,
    at: new Date().toISOString(),
    failureCode: /^[0-9A-Z]{5}$/u.test(error.code ?? "") ? error.code : "budget_validation_failed",
    sessionsTerminated: 0,
  });
  process.stderr.write("Connection budget operation failed without exposing configuration.\n");
  process.exitCode = 1;
} finally {
  await pool.end();
}
