import { and, eq, notInArray, or } from "drizzle-orm";

import type { StackLensDatabase } from "./database.js";
import { analysisReports, analyses } from "./schema.js";
import type {
  AnalysisCompletion,
  AnalysisFailureUpdate,
  AnalysisProgressStage,
  AnalysisRetryUpdate,
  CreateQueuedRepositoryAnalysis,
  RepositoryAnalysisRecord,
  StoredAnalysisReport,
} from "./types.js";

const TERMINAL_STATUSES = ["completed", "completed_with_limitations", "failed"] as const;

function compactRecord(row: typeof analyses.$inferSelect): RepositoryAnalysisRecord {
  return {
    id: row.id,
    inputType: row.inputType,
    repositoryUrl: row.repositoryUrl,
    ...(row.requestedRef === null ? {} : { requestedRef: row.requestedRef }),
    status: row.status,
    progressStage: row.progressStage,
    ...(row.repositoryOwner === null ? {} : { repositoryOwner: row.repositoryOwner }),
    ...(row.repositoryName === null ? {} : { repositoryName: row.repositoryName }),
    ...(row.commitSha === null ? {} : { commitSha: row.commitSha }),
    ...(row.inputFingerprint === null ? {} : { inputFingerprint: row.inputFingerprint }),
    ...(row.analyzerVersion === null ? {} : { analyzerVersion: row.analyzerVersion }),
    ...(row.ruleSetVersion === null ? {} : { ruleSetVersion: row.ruleSetVersion }),
    ...(row.scoringVersion === null ? {} : { scoringVersion: row.scoringVersion }),
    createdAt: row.createdAt,
    ...(row.startedAt === null ? {} : { startedAt: row.startedAt }),
    ...(row.completedAt === null ? {} : { completedAt: row.completedAt }),
    updatedAt: row.updatedAt,
    ...(row.retentionExpiresAt === null ? {} : { retentionExpiresAt: row.retentionExpiresAt }),
    ...(row.failureSummary === null ? {} : { failureSummary: row.failureSummary }),
  };
}

export interface AnalysisRepository {
  createQueuedRepositoryAnalysis(input: CreateQueuedRepositoryAnalysis): Promise<RepositoryAnalysisRecord>;
  findAnalysis(id: string): Promise<RepositoryAnalysisRecord | undefined>;
  findReport(analysisId: string): Promise<StoredAnalysisReport | undefined>;
  claimForExecution(id: string, jobId: string, startedAt: string): Promise<boolean>;
  updateProgress(
    id: string,
    jobId: string,
    stage: AnalysisProgressStage,
    updatedAt: string,
  ): Promise<void>;
  markRetryPending(update: AnalysisRetryUpdate): Promise<void>;
  complete(update: AnalysisCompletion): Promise<void>;
  fail(update: AnalysisFailureUpdate): Promise<void>;
}

export class DrizzleAnalysisRepository implements AnalysisRepository {
  constructor(private readonly database: StackLensDatabase) {}

  async createQueuedRepositoryAnalysis(
    input: CreateQueuedRepositoryAnalysis,
  ): Promise<RepositoryAnalysisRecord> {
    await this.database
      .insert(analyses)
      .values({
        id: input.id,
        inputType: "repository",
        repositoryUrl: input.repositoryUrl,
        ...(input.requestedRef === undefined ? {} : { requestedRef: input.requestedRef }),
        status: "queued",
        progressStage: "queued",
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        ...(input.retentionExpiresAt === undefined
          ? {}
          : { retentionExpiresAt: input.retentionExpiresAt }),
      })
      .onConflictDoNothing({ target: analyses.id });

    const record = await this.findAnalysis(input.id);

    if (record === undefined) {
      throw new Error("Failed to persist repository analysis.");
    }

    if (record.repositoryUrl !== input.repositoryUrl || record.requestedRef !== input.requestedRef) {
      throw new Error("Analysis identifier is already bound to different repository input.");
    }

    return record;
  }

  async findAnalysis(id: string): Promise<RepositoryAnalysisRecord | undefined> {
    const [row] = await this.database.select().from(analyses).where(eq(analyses.id, id)).limit(1);
    return row === undefined ? undefined : compactRecord(row);
  }

  async findReport(analysisId: string): Promise<StoredAnalysisReport | undefined> {
    const [row] = await this.database
      .select()
      .from(analysisReports)
      .where(eq(analysisReports.analysisId, analysisId))
      .limit(1);

    return row === undefined ? undefined : row;
  }

  async claimForExecution(id: string, jobId: string, startedAt: string): Promise<boolean> {
    const [row] = await this.database
      .update(analyses)
      .set({
        status: "running",
        activeJobId: jobId,
        startedAt,
        updatedAt: startedAt,
        failureSummary: null,
      })
      .where(
        and(
          eq(analyses.id, id),
          or(
            eq(analyses.status, "queued"),
            and(eq(analyses.status, "running"), eq(analyses.activeJobId, jobId)),
          ),
        ),
      )
      .returning({ id: analyses.id });

    return row !== undefined;
  }

  async updateProgress(
    id: string,
    jobId: string,
    stage: AnalysisProgressStage,
    updatedAt: string,
  ): Promise<void> {
    await this.database
      .update(analyses)
      .set({
        progressStage: stage,
        updatedAt,
      })
      .where(
        and(
          eq(analyses.id, id),
          eq(analyses.status, "running"),
          eq(analyses.activeJobId, jobId),
        ),
      );
  }

  async markRetryPending(update: AnalysisRetryUpdate): Promise<void> {
    await this.database
      .update(analyses)
      .set({
        status: "queued",
        progressStage: "queued",
        activeJobId: null,
        failureSummary: update.failureSummary,
        updatedAt: update.updatedAt,
      })
      .where(
        and(
          eq(analyses.id, update.id),
          eq(analyses.activeJobId, update.jobId),
          notInArray(analyses.status, [...TERMINAL_STATUSES]),
        ),
      );
  }

  async complete(update: AnalysisCompletion): Promise<void> {
    const repository =
      update.report.input.type === "repository" ? update.report.input.repository : undefined;

    await this.database.transaction(async (transaction) => {
      await transaction
        .insert(analysisReports)
        .values({
          analysisId: update.id,
          reportSchemaVersion: update.report.schemaVersion,
          report: update.report,
          createdAt: update.completedAt,
        })
        .onConflictDoUpdate({
          target: analysisReports.analysisId,
          set: {
            reportSchemaVersion: update.report.schemaVersion,
            report: update.report,
            createdAt: update.completedAt,
          },
        });

      await transaction
        .update(analyses)
        .set({
          status: update.status,
          progressStage: update.status,
          ...(repository === undefined
            ? {}
            : {
                repositoryOwner: repository.owner,
                repositoryName: repository.name,
                commitSha: repository.commitSha,
              }),
          inputFingerprint: update.report.input.fingerprint,
          analyzerVersion: update.report.analyzer.version,
          ruleSetVersion: update.report.analyzer.ruleSetVersion,
          scoringVersion: update.report.analyzer.scoringVersion,
          activeJobId: null,
          completedAt: update.completedAt,
          updatedAt: update.completedAt,
          failureSummary: null,
        })
        .where(eq(analyses.id, update.id));
    });
  }

  async fail(update: AnalysisFailureUpdate): Promise<void> {
    await this.database
      .update(analyses)
      .set({
        status: "failed",
        progressStage: "failed",
        activeJobId: null,
        failureSummary: update.failureSummary,
        completedAt: update.completedAt,
        updatedAt: update.completedAt,
      })
      .where(and(eq(analyses.id, update.id), notInArray(analyses.status, [...TERMINAL_STATUSES])));
  }
}
