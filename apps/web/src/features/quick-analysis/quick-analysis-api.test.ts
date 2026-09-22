import { describe, expect, it } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";

import { createRepositoryReportFixture } from "../repository-analysis/test-fixture.js";
import {
  QuickAnalysisApiError,
  createQuickAnalysisClient,
  type QuickAnalysisFetch,
} from "./quick-analysis-api.js";

function manifestReport(): AnalysisReport {
  const report = createRepositoryReportFixture();

  return {
    ...report,
    input: {
      type: "manifest",
      fingerprint: "fnv1a64:1a:0123456789abcdef",
    },
  };
}

function requestInputUrl(input: Parameters<QuickAnalysisFetch>[0]): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

const invalidJsonFetch: QuickAnalysisFetch = () =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        code: "invalid_json",
        message: "package.json must contain valid JSON.",
      }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    ),
  );

const invalidReportFetch: QuickAnalysisFetch = () =>
  Promise.resolve(
    new Response(JSON.stringify({ report: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );

describe("quick analysis API client [FR-001, FR-002, FR-004, FR-017, FR-021]", () => {
  it("submits the existing synchronous paste contract and validates the report", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const report = manifestReport();
    const fetchImpl: QuickAnalysisFetch = async (input, init) => {
      requests.push({ url: requestInputUrl(input), ...(init === undefined ? {} : { init }) });

      return new Response(JSON.stringify({ report }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createQuickAnalysisClient({
      baseUrl: "https://api.example.test/",
      fetchImpl,
    });

    await expect(
      client.analyzeManifest({ kind: "paste", content: '{"name":"demo"}' }),
    ).resolves.toEqual(report);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/v1/analyze/manifest");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({ kind: "paste", content: '{"name":"demo"}' }),
    );
  });

  it("submits upload filename plus text without introducing multipart behavior", async () => {
    const report = manifestReport();
    let requestBody: BodyInit | null | undefined;
    const fetchImpl: QuickAnalysisFetch = async (_input, init) => {
      requestBody = init?.body;
      return new Response(JSON.stringify({ report }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createQuickAnalysisClient({ fetchImpl });

    await client.analyzeManifest({
      kind: "upload",
      filename: "package.json",
      content: '{"name":"demo"}',
    });

    expect(requestBody).toBe(
      JSON.stringify({
        kind: "upload",
        filename: "package.json",
        content: '{"name":"demo"}',
      }),
    );
  });

  it("preserves stable Fastify validation messages for recoverable input errors", async () => {
    const client = createQuickAnalysisClient({ fetchImpl: invalidJsonFetch });

    await expect(client.analyzeManifest({ kind: "paste", content: "{" })).rejects.toMatchObject({
      name: "QuickAnalysisApiError",
      code: "invalid_json",
      status: 400,
      message: "package.json must contain valid JSON.",
    } satisfies Partial<QuickAnalysisApiError>);
  });

  it("fails closed when a successful response is not a contract-valid AnalysisReport", async () => {
    const client = createQuickAnalysisClient({ fetchImpl: invalidReportFetch });

    await expect(
      client.analyzeManifest({ kind: "paste", content: '{"name":"demo"}' }),
    ).rejects.toMatchObject({
      code: "invalid_response",
      status: 200,
    });
  });
});
