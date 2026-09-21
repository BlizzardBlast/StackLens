import { describe, expect, it } from "vitest";

import { AnalysisReportSchema } from "@stacklens/contracts";

import {
  RepositoryAnalysisApiError,
  createRepositoryAnalysisClient,
  type FetchLike,
} from "./repository-analysis-api.js";
import { createRepositoryReportFixture } from "./test-fixture.js";

describe("repository analysis API client [FR-003, FR-004, FR-017, FR-021]", () => {
  it("submits only the public repository URL expected by the J3 transport", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      requests.push({ url: String(input), ...(init === undefined ? {} : { init }) });

      return new Response(JSON.stringify({ analysisId: "analysis-123" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    };
    const client = createRepositoryAnalysisClient({
      baseUrl: "https://api.example.test/",
      fetchImpl,
    });

    await expect(
      client.submitRepository("https://github.com/BlizzardBlast/StackLens"),
    ).resolves.toEqual({ analysisId: "analysis-123" });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.example.test/v1/analyses/repository");
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({ repositoryUrl: "https://github.com/BlizzardBlast/StackLens" }),
    );
  });

  it("validates a terminal report with the shared AnalysisReport contract", async () => {
    const report = createRepositoryReportFixture();
    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);

    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          analysisId: report.analysisId,
          repositoryUrl: "https://github.com/BlizzardBlast/StackLens",
          status: "completed_with_limitations",
          progressStage: "completed_with_limitations",
          createdAt: report.createdAt,
          updatedAt: report.createdAt,
          completedAt: report.createdAt,
          report,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    const client = createRepositoryAnalysisClient({ fetchImpl });

    const snapshot = await client.getAnalysis(report.analysisId);

    expect(snapshot.status).toBe("completed_with_limitations");
    expect(snapshot.report?.analysisId).toBe(report.analysisId);
  });

  it("preserves stable server validation errors without exposing transport internals", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({
          code: "invalid_repository_url",
          message: "Enter a supported public GitHub repository URL.",
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    const client = createRepositoryAnalysisClient({ fetchImpl });

    await expect(client.submitRepository("https://example.com/repository")).rejects.toMatchObject({
      name: "RepositoryAnalysisApiError",
      code: "invalid_repository_url",
      status: 400,
      message: "Enter a supported public GitHub repository URL.",
    } satisfies Partial<RepositoryAnalysisApiError>);
  });
});
