import type { AnalysisReport } from "@stacklens/contracts";

export const ANALYSIS_STATUSES = [
  "queued",
  "running",
  "completed",
  "completed_with_limitations",
  "failed",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const ANALYSIS_PROGRESS_STAGES = [
  "queued",
  "resolving_repository",
  "collecting_snapshot",
  "collecting_metadata",
  "running_rules",
  "scoring",
  "completed",
  "completed_with_limitations",
  "failed",
] as const;

export type AnalysisProgressStage = (typeof ANALYSIS_PROGRESS_STAGES)[number];

export interface AnalysisFailureSummary {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface RepositoryAnalysisRecord {
  readonly id: string;
  readonly inputType: "repository";
  readonly repositoryUrl: string;
  readonly requestedRef?: string;
  readonly status: AnalysisStatus;
  readonly progressStage: AnalysisProgressStage;
  readonly repositoryOwner?: string;
  readonly repositoryName?: string;
  readonly commitSha?: string;
  readonly inputFingerprint?: string;
  readonly analyzerVersion?: string;
  readonly ruleSetVersion?: string;
  readonly scoringVersion?: string;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly updatedAt: string;
  readonly retentionExpiresAt?: string;
  readonly failureSummary?: AnalysisFailureSummary;
}

export interface StoredAnalysisReport {
  readonly analysisId: string;
  readonly reportSchemaVersion: string;
  readonly report: AnalysisReport;
  readonly createdAt: string;
}

export interface CreateQueuedRepositoryAnalysis {
  readonly id: string;
  readonly repositoryUrl: string;
  readonly requestedRef?: string;
  readonly createdAt: string;
  readonly retentionExpiresAt?: string;
}

export interface AnalysisRetryUpdate {
  readonly id: string;
  readonly jobId: string;
  readonly failureSummary: AnalysisFailureSummary;
  readonly updatedAt: string;
}

export interface AnalysisFailureUpdate extends AnalysisRetryUpdate {
  readonly completedAt: string;
}

export interface AnalysisCompletion {
  readonly id: string;
  readonly report: AnalysisReport;
  readonly completedAt: string;
  readonly status: "completed" | "completed_with_limitations";
}

export function isTerminalAnalysisStatus(status: AnalysisStatus): boolean {
  return status === "completed" || status === "completed_with_limitations" || status === "failed";
}
