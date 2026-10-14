import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execute = promisify(execFile);

describe("Fastify request privacy [FR-100, SEC-007, NFR-009]", () => {
  it("omits sensitive URLs and codes from native logger messages and error responses", async () => {
    const serverUrl = new URL("../src/server.ts", import.meta.url).href;
    const markers = [
      "synthetic-oauth-code",
      "synthetic-private-analysis",
      "synthetic-cookie",
      "synthetic-error-detail",
    ];
    // Capture the real Pino output in a child rather than replacing its serializer with a mock.
    const script = `
      import { createStackLensApi } from ${JSON.stringify(serverUrl)};
      const app = await createStackLensApi({ logger: true,
        repository: { async findAnalysis() { throw new Error('synthetic-error-detail'); } },
        deliveryDispatcher: { async dispatchReady() {} },
      });
      app.get('/review-failure/:analysisId', async () => { throw new Error('synthetic-error-detail'); });
      try {
        const requests = [
          { method: 'GET', url: '/v1/auth/github/callback/?code=synthetic-oauth-code', headers: { cookie: 'session=synthetic-cookie' } },
          { method: 'GET', url: '/review-failure/synthetic-private-analysis' },
          { method: 'POST', url: '/v1/analyses?code=synthetic-oauth-code', headers: { 'content-type': 'application/json' }, payload: '{' },
        ];
        const responses = [];
        for (const request of requests) {
          const response = await app.inject(request);
          responses.push({ status: response.statusCode, body: response.json(), cache: response.headers['cache-control'] });
        }
        console.log(JSON.stringify({ reviewReceipt: true, responses }));
      } finally { await app.close(); }
    `;
    const result = await execute(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { timeout: 15_000 },
    );
    for (const marker of markers) expect(result.stdout + result.stderr).not.toContain(marker);
    const records = result.stdout
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line): unknown => JSON.parse(line));
    expect(records).toContainEqual({
      reviewReceipt: true,
      responses: [
        {
          status: 404,
          body: { code: "not_found", message: "The requested route was not found." },
          cache: "private, no-store",
        },
        {
          status: 500,
          body: { code: "internal_error", message: "The request could not be completed." },
          cache: "private, no-store",
        },
        {
          status: 400,
          body: { code: "invalid_request", message: "Request does not match the API schema." },
          cache: "private, no-store",
        },
      ],
    });
  }, 20_000);
});
