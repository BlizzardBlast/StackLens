import { afterEach, describe, expect, it } from "vitest";

import {
  createStackLensApiRuntime,
  type StackLensApiRuntime,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const describeWithDatabase = databaseUrl.length > 0 ? describe : describe.skip;
const openRuntimes: StackLensApiRuntime[] = [];

afterEach(async () => {
  const runtimes = openRuntimes.splice(0);
  await Promise.all(runtimes.map(async (runtime) => runtime.stop()));
});

describeWithDatabase("API runtime composition [FR-003, NFR-008, NFR-009]", () => {
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
});
