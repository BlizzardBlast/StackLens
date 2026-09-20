import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import type { AnalysisReport } from "@stacklens/contracts";

import type { AnalysisFailureSummary, AnalysisProgressStage, AnalysisStatus } from "./types.js";

export const analyses = pgTable("analysis", {
  id: text("id").primaryKey(),
  inputType: text("input_type").$type<"repository">().notNull(),
  repositoryUrl: text("repository_url").notNull(),
  requestedRef: text("requested_ref"),
  status: text("status").$type<AnalysisStatus>().notNull(),
  progressStage: text("progress_stage").$type<AnalysisProgressStage>().notNull(),
  activeJobId: text("active_job_id"),
  repositoryOwner: text("repository_owner"),
  repositoryName: text("repository_name"),
  commitSha: text("commit_sha"),
  inputFingerprint: text("input_fingerprint"),
  analyzerVersion: text("analyzer_version"),
  ruleSetVersion: text("rule_set_version"),
  scoringVersion: text("scoring_version"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { mode: "string", withTimezone: true }),
  completedAt: timestamp("completed_at", { mode: "string", withTimezone: true }),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull(),
  retentionExpiresAt: timestamp("retention_expires_at", { mode: "string", withTimezone: true }),
  failureSummary: jsonb("failure_summary").$type<AnalysisFailureSummary>(),
});

export const analysisReports = pgTable("analysis_report", {
  analysisId: text("analysis_id")
    .primaryKey()
    .references(() => analyses.id, { onDelete: "cascade" }),
  reportSchemaVersion: text("report_schema_version").notNull(),
  report: jsonb("report").$type<AnalysisReport>().notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull(),
});
