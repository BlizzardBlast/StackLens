import { afterEach, describe, expect, it } from "vitest";

import { createStackLensApiRuntime, type StackLensApiRuntime } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const describeWithDatabase = databaseUrl.length > 0 ? describe : describe.skip;
const openRuntimes: StackLensApiRuntime[] = [];

afterEach(async () => {
  const runtimes = openRuntimes.splice(0);
  await Promise.all(runtimes.map(async (runtime) => runtime.stop()));
});

describeWithDatabase(
  "API runtime composition [FR-001, FR-003, FR-017, FR-021, FR-022, NFR-008, NFR-009]",
  () => {
  it("migrates PostgreSQL/Graphile and enqueues repository analysis through the real adapters", async () => {
    const runtime = await createStackLensApiRuntime({
      connectionString: databaseUrl,
      logger: false,
    });
    openRuntimes.push(runtime);

    const submitted = await runtime.app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/runtime-smoke",
      },
    });

    expect(submitted.statusCode).toBe(202);

    const { analysisId } = submitted.json<{ analysisId: string }>();
    expect(analysisId).toBeTruthy();

    const status = await runtime.app.inject({
      method: "GET",
      url: `/v1/analyses/${encodeURIComponent(analysisId)}`,
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      analysisId,
      repositoryUrl: "https://github.com/acme/runtime-smoke",
      status: "queued",
      progressStage: "queued",
    });
    expect(status.body).not.toContain("jobId");
    expect(status.body).not.toContain("activeJobId");
  });

  it("serves quick manifest analysis through the real runtime without durable analysis state", async () => {
    const runtime = await createStackLensApiRuntime({
      connectionString: databaseUrl,
      logger: false,
    });
    openRuntimes.push(runtime);

    const response = await runtime.app.inject({
      method: "POST",
      url: "/v1/analyze/manifest",
      payload: {
        kind: "paste",
        content: JSON.stringify({
          name: "runtime-quick-smoke",
          dependencies: {
            react: "19.3.0",
          },
        }),
      },
    });

    expect(response.statusCode).toBe(200);

    const { report } = response.json<{
      report: {
        analysisId: string;
        input: {
          type: string;
        };
        limitations: Array<{ message: string }>;
      };
    }>();

    expect(report.analysisId).toBeTruthy();
    expect(report.input.type).toBe("manifest");
    expect(report.limitations.length).toBeGreaterThan(0);

    const durableLookup = await runtime.app.inject({
      method: "GET",
      url: `/v1/analyses/${encodeURIComponent(report.analysisId)}`,
    });

    expect(durableLookup.statusCode).toBe(404);
    expect(durableLookup.json()).toMatchObject({
      code: "analysis_not_found",
    });
  });
});
