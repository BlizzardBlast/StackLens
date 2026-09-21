import * as z from "zod";

import { AnalysisReportSchema, IsoDateTimeSchema } from "@stacklens/contracts";

const ANALYSIS_STATUSES = [
  "queued",
  "running",
  "completed",
  "completed_with_limitations",
  "failed",
] as const;

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

const ApiErrorPayloadSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
});

const RepositoryAnalysisAcceptedSchema = z.strictObject({
  analysisId: z.string().min(1),
});

const AnalysisFailureSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
});

const RepositoryAnalysisSnapshotSchema = z.strictObject({
  analysisId: z.string().min(1),
  repositoryUrl: z.string(),
  status: z.enum(ANALYSIS_STATUSES),
  progressStage: z.enum(ANALYSIS_PROGRESS_STAGES),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  startedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
  failure: AnalysisFailureSchema.optional(),
  report: AnalysisReportSchema.optional(),
});

export type RepositoryAnalysisStatus = (typeof ANALYSIS_STATUSES)[number];
export type RepositoryAnalysisProgressStage = (typeof ANALYSIS_PROGRESS_STAGES)[number];
export type RepositoryAnalysisSnapshot = z.infer<typeof RepositoryAnalysisSnapshotSchema>;

export interface SubmitRepositoryAnalysisResult {
  readonly analysisId: string;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface RepositoryAnalysisClient {
  submitRepository(
    repositoryUrl: string,
    signal?: AbortSignal,
  ): Promise<SubmitRepositoryAnalysisResult>;
  getAnalysis(analysisId: string, signal?: AbortSignal): Promise<RepositoryAnalysisSnapshot>;
}

export interface RepositoryAnalysisClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: FetchLike;
}

export class RepositoryAnalysisApiError extends Error {
  override readonly name = "RepositoryAnalysisApiError";

  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function requestUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RepositoryAnalysisApiError(
      "invalid_response",
      "StackLens received an invalid API response.",
      response.status,
    );
  }
}

async function ensureSuccessPayload<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const payload = await responsePayload(response);

  if (!response.ok) {
    const parsedError = ApiErrorPayloadSchema.safeParse(payload);

    throw new RepositoryAnalysisApiError(
      parsedError.success ? parsedError.data.code : "request_failed",
      parsedError.success ? parsedError.data.message : "StackLens could not complete the request.",
      response.status,
    );
  }

  const parsedPayload = schema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new RepositoryAnalysisApiError(
      "invalid_response",
      "StackLens received an invalid API response.",
      response.status,
    );
  }

  return parsedPayload.data;
}

export function createRepositoryAnalysisClient({
  baseUrl = "",
  fetchImpl = globalThis.fetch.bind(globalThis),
}: RepositoryAnalysisClientOptions = {}): RepositoryAnalysisClient {
  return {
    async submitRepository(repositoryUrl, signal) {
      const response = await fetchImpl(requestUrl(baseUrl, "/v1/analyses/repository"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ repositoryUrl }),
        ...(signal === undefined ? {} : { signal }),
      });

      return ensureSuccessPayload(response, RepositoryAnalysisAcceptedSchema);
    },

    async getAnalysis(analysisId, signal) {
      const encodedId = encodeURIComponent(analysisId);
      const response = await fetchImpl(requestUrl(baseUrl, `/v1/analyses/${encodedId}`), {
        method: "GET",
        ...(signal === undefined ? {} : { signal }),
      });

      return ensureSuccessPayload(response, RepositoryAnalysisSnapshotSchema);
    },
  };
}

export function isTerminalRepositoryAnalysisStatus(status: RepositoryAnalysisStatus): boolean {
  return status === "completed" || status === "completed_with_limitations" || status === "failed";
}

const configuredApiBaseUrl = import.meta.env.VITE_STACKLENS_API_BASE_URL ?? "";

export const repositoryAnalysisClient = createRepositoryAnalysisClient({
  baseUrl: configuredApiBaseUrl,
});
