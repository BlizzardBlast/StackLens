import * as z from "zod";

import { AnalysisReportSchema, type AnalysisReport } from "@stacklens/contracts";

const ApiErrorPayloadSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
});

const QuickManifestAnalysisResponseSchema = z.strictObject({
  report: AnalysisReportSchema,
});

export type QuickManifestAnalysisInput =
  | {
      readonly kind: "paste";
      readonly content: string;
    }
  | {
      readonly kind: "upload";
      readonly filename: string;
      readonly content: string;
    };

export type QuickAnalysisFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface QuickAnalysisClient {
  analyzeManifest(input: QuickManifestAnalysisInput, signal?: AbortSignal): Promise<AnalysisReport>;
}

export interface QuickAnalysisClientOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: QuickAnalysisFetch;
}

export class QuickAnalysisApiError extends Error {
  override readonly name = "QuickAnalysisApiError";

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
    throw new QuickAnalysisApiError(
      "invalid_response",
      "StackLens received an invalid API response.",
      response.status,
    );
  }
}

async function parseResponse(response: Response): Promise<AnalysisReport> {
  const payload = await responsePayload(response);

  if (!response.ok) {
    const parsedError = ApiErrorPayloadSchema.safeParse(payload);

    throw new QuickAnalysisApiError(
      parsedError.success ? parsedError.data.code : "request_failed",
      parsedError.success ? parsedError.data.message : "StackLens could not complete the request.",
      response.status,
    );
  }

  const parsedPayload = QuickManifestAnalysisResponseSchema.safeParse(payload);

  if (!parsedPayload.success) {
    throw new QuickAnalysisApiError(
      "invalid_response",
      "StackLens received an invalid API response.",
      response.status,
    );
  }

  return parsedPayload.data.report;
}

export function createQuickAnalysisClient({
  baseUrl = "",
  fetchImpl = globalThis.fetch.bind(globalThis),
}: QuickAnalysisClientOptions = {}): QuickAnalysisClient {
  return {
    async analyzeManifest(input, signal) {
      const response = await fetchImpl(requestUrl(baseUrl, "/v1/analyze/manifest"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        ...(signal === undefined ? {} : { signal }),
      });

      return parseResponse(response);
    },
  };
}

const configuredApiBaseUrl = import.meta.env.VITE_STACKLENS_API_BASE_URL ?? "";

export const quickAnalysisClient = createQuickAnalysisClient({
  baseUrl: configuredApiBaseUrl,
});
