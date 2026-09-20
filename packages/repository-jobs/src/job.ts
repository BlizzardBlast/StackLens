export const REPOSITORY_ANALYSIS_TASK_IDENTIFIER = "repository_analysis";
export const REPOSITORY_ANALYSIS_MAX_ATTEMPTS = 5;

export interface RepositoryAnalysisJobPayload {
  readonly analysisId: string;
  readonly repositoryUrl: string;
  readonly ref?: string;
}

export function parseRepositoryAnalysisJobPayload(value: unknown): RepositoryAnalysisJobPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Repository analysis job payload must be an object.");
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(["analysisId", "repositoryUrl", "ref"]);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new Error("Repository analysis job payload contains an unsupported field.");
    }
  }

  const analysisId = record.analysisId;
  const repositoryUrl = record.repositoryUrl;
  const ref = record.ref;

  if (typeof analysisId !== "string" || analysisId.length === 0 || analysisId.length > 200) {
    throw new Error("Repository analysis job payload has an invalid analysisId.");
  }

  if (
    typeof repositoryUrl !== "string" ||
    repositoryUrl.length === 0 ||
    repositoryUrl.length > 2_000
  ) {
    throw new Error("Repository analysis job payload has an invalid repositoryUrl.");
  }

  if (
    ref !== undefined &&
    (typeof ref !== "string" || ref.length === 0 || ref.length > 500)
  ) {
    throw new Error("Repository analysis job payload has an invalid ref.");
  }

  return {
    analysisId,
    repositoryUrl,
    ...(ref === undefined ? {} : { ref }),
  };
}
