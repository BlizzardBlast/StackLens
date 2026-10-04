// FR-003/022, NFR-008/009, SEC-003/007: bounded API access; never grant owner or Graphile privileges.
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { readPrivateConfiguration, record, removePrivateFile } from "./common.mjs";

export async function grantRestrictedApiAccess(client, role) {
  const statements = (
    await client.query(
      `SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), $1::text) AS database,
       format('GRANT USAGE ON SCHEMA public TO %I', $1::text) AS schema,
       format('GRANT SELECT ON public.analysis, public.analysis_report, public.analysis_delivery TO %I', $1::text) AS reads,
       format('GRANT INSERT ON public.analysis, public.analysis_delivery TO %I', $1::text) AS writes`,
      [role],
    )
  ).rows[0];
  await client.query(statements.database);
  await client.query(statements.schema);
  await client.query(statements.reads);
  await client.query(statements.writes);
}

export async function inspectRestrictedApiAccess(client, role) {
  return (
    await client.query(
      `SELECT rolconnlimit AS connection_limit, rolsuper AS superuser, rolcreatedb AS create_database,
       rolcreaterole AS create_role, rolreplication AS replication, rolbypassrls AS bypass_rls,
       has_database_privilege($1::text, current_database(), 'CREATE') AS create_database_objects,
       EXISTS (SELECT 1 FROM pg_auth_members WHERE member = pg_roles.oid) AS role_membership,
       has_schema_privilege($1::text, 'public', 'CREATE') AS create_public_objects,
       has_schema_privilege($1::text, 'graphile_worker', 'USAGE') AS graphile_access,
       has_table_privilege($1::text, 'public.analysis', 'SELECT') AND
         has_table_privilege($1::text, 'public.analysis', 'INSERT') AS analysis_access,
       has_table_privilege($1::text, 'public.analysis_report', 'SELECT') AS report_read,
       has_table_privilege($1::text, 'public.analysis_delivery', 'SELECT') AND
         has_table_privilege($1::text, 'public.analysis_delivery', 'INSERT') AS outbox_access,
       has_table_privilege($1::text, 'public.analysis', 'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') OR
         has_table_privilege($1::text, 'public.analysis_report', 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') OR
         has_table_privilege($1::text, 'public.analysis_delivery', 'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') AS forbidden_writes
       FROM pg_roles WHERE rolname = $1`,
      [role],
    )
  ).rows[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, configuration, privateOutput, evidenceOutput] = process.argv.slice(2);
  let pool,
    client,
    privateWritten = false,
    committed = false;
  try {
    if (!["plan", "apply"].includes(mode)) throw new Error("invalid_mode");
    const environment = await readPrivateConfiguration(configuration);
    if (!environment.STACKLENS_DATABASE_SSL_CA) throw new Error("verified_ca_required");
    pool = createStackLensPool(environment.DATABASE_URL, undefined, {
      max: 1,
      sslCa: environment.STACKLENS_DATABASE_SSL_CA.replaceAll("\\n", "\n"),
    });
    client = await pool.connect();
    const role = "stacklens_api_preview",
      limit = 6;
    const capacity = (
      await client.query(
        "SELECT current_setting('max_connections')::int - current_setting('superuser_reserved_connections')::int - current_setting('reserved_connections')::int AS ordinary_slots",
      )
    ).rows[0].ordinary_slots;
    if (capacity - limit < 11) throw new Error("insufficient_budget_headroom");
    const clients = (
      await client.query(
        "SELECT count(*)::int AS clients FROM pg_stat_activity WHERE backend_type = 'client backend'",
      )
    ).rows[0].clients;
    if (clients > capacity - limit) throw new Error("insufficient_active_headroom");
    if ((await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role])).rows.length)
      throw new Error("restricted_role_already_exists");
    if (mode === "plan") {
      await record(evidenceOutput, {
        status: "reviewable_plan",
        role,
        connectionLimit: limit,
        ordinarySlots: capacity,
        observedClients: clients,
        ownerOrGraphileGrants: false,
      });
    } else {
      const password = randomBytes(32).toString("base64url");
      const url = new URL(environment.DATABASE_URL);
      url.username = role;
      url.password = password;
      await mkdir(dirname(resolve(privateOutput)), { recursive: true });
      await client.query("BEGIN");
      const sql = (
        await client.query(
          "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L CONNECTION LIMIT 6 NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', $1::text, $2::text) AS statement",
          [role, password],
        )
      ).rows[0].statement;
      await client.query(sql);
      await grantRestrictedApiAccess(client, role);
      const privileges = await inspectRestrictedApiAccess(client, role);
      if (
        !privileges ||
        privileges.superuser ||
        privileges.create_database ||
        privileges.create_role ||
        privileges.replication ||
        privileges.bypass_rls ||
        privileges.create_database_objects ||
        privileges.role_membership ||
        privileges.create_public_objects ||
        privileges.graphile_access ||
        privileges.forbidden_writes ||
        !privileges.analysis_access ||
        !privileges.report_read ||
        !privileges.outbox_access
      )
        throw new Error("restricted_privilege_check_failed");
      // Exclusive output prevents replacing a credential used by an existing deployment.
      await writeFile(
        privateOutput,
        JSON.stringify({ ...environment, DATABASE_URL: url.toString() }),
        { mode: 0o600, flag: "wx" },
      );
      privateWritten = true;
      await client.query("COMMIT");
      committed = true;
      await record(evidenceOutput, {
        status: "restricted_login_provisioned",
        at: new Date().toISOString(),
        role,
        ordinarySlots: capacity,
        observedClients: clients,
        ...privileges,
        apiDeploymentChanged: false,
        sessionsTerminated: 0,
      });
    }
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    if (privateWritten && !committed) await removePrivateFile(privateOutput);
    await record(evidenceOutput, {
      status: "failed",
      failureCode: /^[0-9A-Z]{5}$/u.test(error.code ?? "")
        ? error.code
        : "restricted_login_validation_failed",
      sessionsTerminated: 0,
    });
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool?.end();
  }
}
