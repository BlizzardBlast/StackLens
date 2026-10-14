import { getTableColumns, sql } from "drizzle-orm";

import type { StackLensDatabase } from "./database.js";
import { ownershipPoliciesValid } from "./ownership-policies.js";
import { analyses, analysisDeliveries, analysisReports } from "./schema.js";

/** Verify the current reader's columns without DDL or retaining report/source content. */
export async function verifyStackLensDatabase(database: StackLensDatabase): Promise<void> {
  await Promise.all([
    database
      .select({
        ...getTableColumns(analyses),
        ownerGithubId: sql`pg_catalog.to_jsonb(${analyses})->>'owner_github_id'`,
        githubConnectionId: sql`pg_catalog.to_jsonb(${analyses})->>'github_connection_id'`,
      })
      .from(analyses)
      .limit(0),
    database.select().from(analysisReports).limit(0),
    database.select().from(analysisDeliveries).limit(0),
  ]);
}

/** FR-100 activation must never use an owner/BYPASSRLS API or a legacy unprotected schema. */
export async function verifyConnectedApiDatabase(database: StackLensDatabase): Promise<void> {
  await database
    .select({
      ownerGithubId: analyses.ownerGithubId,
      githubConnectionId: analyses.githubConnectionId,
    })
    .from(analyses)
    .limit(0);
  const result = await database.execute(sql`SELECT
    current_user = session_user AS session_login,
    (SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication FROM pg_catalog.pg_roles WHERE rolname = current_user) AS privileged,
    EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)) AS membership,
    EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid IN ('analysis'::pg_catalog.regclass, 'analysis_report'::pg_catalog.regclass, 'analysis_delivery'::pg_catalog.regclass)
      AND (NOT relrowsecurity OR relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user))) AS unsafe_tables,
    EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = 'stacklens_auth.github_connection'::pg_catalog.regclass
      AND relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)) AS connection_owner,
    -- Check every permanent schema, including ones outside this API connection's search path:
    -- a later Worker connection must never resolve API-created objects with stronger privileges.
    pg_catalog.has_database_privilege(current_user, pg_catalog.current_database(), 'CREATE') OR
    EXISTS (SELECT 1 FROM pg_catalog.pg_database WHERE datname = pg_catalog.current_database()
      AND datdba = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)) OR
    EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
      WHERE n.nspname !~ '^pg_(toast_)?temp_' AND
        (n.nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
          OR pg_catalog.has_schema_privilege(current_user, n.oid, 'CREATE'))) AS schema_write,
    -- RLS does not protect TRUNCATE, and column ACLs need checks separate from table ACLs.
    EXISTS (SELECT 1 FROM (VALUES
      ('analysis'::pg_catalog.regclass, 'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN', 'UPDATE,REFERENCES'),
      ('analysis_report'::pg_catalog.regclass, 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN', 'INSERT,UPDATE,REFERENCES'),
      ('analysis_delivery'::pg_catalog.regclass, 'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN', 'UPDATE,REFERENCES'),
      ('stacklens_auth.github_connection'::pg_catalog.regclass, 'UPDATE,TRUNCATE,TRIGGER,REFERENCES,MAINTAIN', 'UPDATE,REFERENCES')
    ) AS permissions(table_oid, forbidden_table, forbidden_column)
      WHERE pg_catalog.has_table_privilege(current_user, table_oid, forbidden_table)
        OR pg_catalog.has_any_column_privilege(current_user, table_oid, forbidden_column)) AS forbidden_access,
    pg_catalog.has_table_privilege(current_user, 'analysis', 'SELECT') AND
    pg_catalog.has_table_privilege(current_user, 'analysis', 'INSERT') AND
    pg_catalog.has_table_privilege(current_user, 'analysis_report', 'SELECT') AND
    pg_catalog.has_table_privilege(current_user, 'analysis_delivery', 'SELECT') AND
    pg_catalog.has_table_privilege(current_user, 'analysis_delivery', 'INSERT') AS analysis_access,
    pg_catalog.has_table_privilege(current_user, 'stacklens_auth.github_connection', 'SELECT') AND
    pg_catalog.has_table_privilege(current_user, 'stacklens_auth.github_connection', 'INSERT') AND
    pg_catalog.has_table_privilege(current_user, 'stacklens_auth.github_connection', 'DELETE') AS connection_access`);
  const policies = await database.execute(sql`SELECT c.relname AS table, p.polname AS name,
    p.polcmd AS command, p.polpermissive AS permissive, p.polroles AS roles,
    pg_catalog.pg_get_expr(p.polqual, p.polrelid) AS using, pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) AS check
    FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
    WHERE p.polrelid IN ('analysis'::pg_catalog.regclass, 'analysis_report'::pg_catalog.regclass, 'analysis_delivery'::pg_catalog.regclass)`);
  const row = result.rows[0];
  if (
    row === undefined ||
    row.session_login !== true ||
    row.privileged !== false ||
    row.membership !== false ||
    row.unsafe_tables !== false ||
    row.connection_owner !== false ||
    row.schema_write !== false ||
    row.forbidden_access !== false ||
    row.analysis_access !== true ||
    row.connection_access !== true ||
    !ownershipPoliciesValid(policies.rows)
  )
    throw new Error("Connected API requires a restricted RLS-protected login.");
}

export async function migrateStackLensDatabase(database: StackLensDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
    // API and Worker may start concurrently against the same database. Serialize only the
    // StackLens schema bootstrap transaction; the lock is automatically released at commit/rollback.
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(1398030670, 1)`);

    await transaction.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis (
        id text PRIMARY KEY,
        input_type text NOT NULL CHECK (input_type = 'repository'),
        repository_url text NOT NULL,
        requested_ref text,
        status text NOT NULL CHECK (
          status IN ('queued', 'running', 'completed', 'completed_with_limitations', 'failed')
        ),
        progress_stage text NOT NULL CHECK (
          progress_stage IN (
            'queued',
            'resolving_repository',
            'collecting_snapshot',
            'collecting_metadata',
            'running_rules',
            'scoring',
            'completed',
            'completed_with_limitations',
            'failed'
          )
        ),
        active_job_id text,
        repository_owner text,
        repository_name text,
        commit_sha text,
        input_fingerprint text,
        analyzer_version text,
        rule_set_version text,
        scoring_version text,
        created_at timestamptz NOT NULL,
        started_at timestamptz,
        completed_at timestamptz,
        updated_at timestamptz NOT NULL,
        retention_expires_at timestamptz,
        failure_summary jsonb
      )
    `);

    await transaction.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_report (
        analysis_id text PRIMARY KEY REFERENCES analysis(id) ON DELETE CASCADE,
        report_schema_version text NOT NULL,
        report jsonb NOT NULL,
        created_at timestamptz NOT NULL
      )
    `);

    // FR-100: nullable ownership preserves legacy anonymous rows and archived report JSON.
    await transaction.execute(
      sql`ALTER TABLE analysis ADD COLUMN IF NOT EXISTS owner_github_id text`,
    );
    await transaction.execute(
      sql`ALTER TABLE analysis ADD COLUMN IF NOT EXISTS github_connection_id text`,
    );
    await transaction.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'analysis'::regclass AND conname = 'analysis_github_owner_pair') THEN
          ALTER TABLE analysis ADD CONSTRAINT analysis_github_owner_pair CHECK (
            (owner_github_id IS NULL AND github_connection_id IS NULL) OR
            (owner_github_id IS NOT NULL AND github_connection_id IS NOT NULL AND owner_github_id ~ '^[0-9]{1,20}$' AND github_connection_id ~ '^[a-f0-9]{64}$')
          );
        END IF;
      END $$
    `);

    // Credentials live outside the public/Graphile schemas captured by analysis backups.
    await transaction.execute(sql`CREATE SCHEMA IF NOT EXISTS stacklens_auth`);
    await transaction.execute(sql`REVOKE ALL ON SCHEMA stacklens_auth FROM PUBLIC`);
    await transaction.execute(sql`CREATE TABLE IF NOT EXISTS stacklens_auth.github_connection (
      session_hash text PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
      github_id text NOT NULL CHECK (github_id ~ '^[0-9]{1,20}$'),
      login text NOT NULL,
      sealed_token text NOT NULL,
      expires_at timestamptz NOT NULL
    )`);
    await transaction.execute(sql`REVOKE ALL ON stacklens_auth.github_connection FROM PUBLIC`);
    await transaction.execute(
      sql`CREATE INDEX IF NOT EXISTS github_connection_expiry_idx ON stacklens_auth.github_connection (expires_at)`,
    );

    await transaction.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_delivery (
        analysis_id text PRIMARY KEY REFERENCES analysis(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('pending', 'delivering', 'delivered')),
        attempts integer NOT NULL CHECK (attempts >= 0),
        available_at timestamptz NOT NULL,
        lease_token text,
        lease_expires_at timestamptz,
        delivered_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      )
    `);

    // Legacy restricted API readers have no identity context and cannot read connected rows.
    await transaction.execute(sql`ALTER TABLE analysis ENABLE ROW LEVEL SECURITY`);
    await transaction.execute(sql`ALTER TABLE analysis_report ENABLE ROW LEVEL SECURITY`);
    await transaction.execute(sql`ALTER TABLE analysis_delivery ENABLE ROW LEVEL SECURITY`);
    await transaction.execute(sql`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid IN ('analysis'::regclass, 'analysis_report'::regclass, 'analysis_delivery'::regclass)
          AND NOT ((polrelid = 'analysis'::regclass AND polname IN ('analysis_owner_read', 'analysis_owner_create'))
            OR (polrelid = 'analysis_report'::regclass AND polname = 'report_owner_read')
            OR (polrelid = 'analysis_delivery'::regclass AND polname IN ('delivery_owner_read', 'delivery_owner_create')))) THEN
          RAISE EXCEPTION 'Unexpected analysis ownership policies require operator review.';
        END IF;
      END $$
    `);
    // Reconcile only StackLens-owned policies atomically; never retain a permissive drifted definition.
    await transaction.execute(sql`DROP POLICY IF EXISTS analysis_owner_read ON analysis`);
    await transaction.execute(sql`DROP POLICY IF EXISTS analysis_owner_create ON analysis`);
    await transaction.execute(sql`DROP POLICY IF EXISTS report_owner_read ON analysis_report`);
    await transaction.execute(sql`DROP POLICY IF EXISTS delivery_owner_read ON analysis_delivery`);
    await transaction.execute(
      sql`DROP POLICY IF EXISTS delivery_owner_create ON analysis_delivery`,
    );
    await transaction.execute(sql`CREATE POLICY analysis_owner_read ON analysis FOR SELECT USING (
      owner_github_id IS NULL OR owner_github_id = nullif(pg_catalog.current_setting('stacklens.owner_github_id', true), '')
    )`);
    await transaction.execute(sql`CREATE POLICY analysis_owner_create ON analysis FOR INSERT WITH CHECK (
      owner_github_id IS NULL OR owner_github_id = nullif(pg_catalog.current_setting('stacklens.owner_github_id', true), '')
    )`);
    await transaction.execute(sql`CREATE POLICY report_owner_read ON analysis_report FOR SELECT USING (
      EXISTS (SELECT 1 FROM analysis WHERE analysis.id = analysis_report.analysis_id)
    )`);
    await transaction.execute(sql`CREATE POLICY delivery_owner_read ON analysis_delivery FOR SELECT USING (
      EXISTS (SELECT 1 FROM analysis WHERE analysis.id = analysis_delivery.analysis_id)
    )`);
    await transaction.execute(sql`CREATE POLICY delivery_owner_create ON analysis_delivery FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM analysis WHERE analysis.id = analysis_delivery.analysis_id)
    )`);

    await transaction.execute(sql`
      CREATE INDEX IF NOT EXISTS analysis_delivery_available_idx
      ON analysis_delivery (available_at)
      WHERE status IN ('pending', 'delivering')
    `);

    await transaction.execute(sql`
      CREATE INDEX IF NOT EXISTS analysis_retention_idx
      ON analysis (retention_expires_at, id)
      WHERE status IN ('completed', 'completed_with_limitations', 'failed')
        AND active_job_id IS NULL
    `);

    await transaction.execute(sql`
      INSERT INTO analysis_delivery (
        analysis_id, status, attempts, available_at, created_at, updated_at
      )
      SELECT id, 'pending', 0, updated_at, updated_at, updated_at
      FROM analysis
      WHERE status = 'queued' AND active_job_id IS NULL
      ON CONFLICT (analysis_id) DO NOTHING
    `);
  });
}
