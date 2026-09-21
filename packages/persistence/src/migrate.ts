import { sql } from "drizzle-orm";

import type { StackLensDatabase } from "./database.js";

export async function migrateStackLensDatabase(database: StackLensDatabase): Promise<void> {
  await database.transaction(async (transaction) => {
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
  });
}
