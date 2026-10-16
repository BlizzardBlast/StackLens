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
      "synthetic-callback-body",
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
          { method: 'POST', url: '/v1/auth/github/callback', headers: { 'content-type': 'application/json', origin: 'https://stacklens.example' }, payload: { code: 'synthetic-callback-body', state: 'synthetic-oauth-code' } },
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
        {
          status: 503,
          body: {
            code: "connection_disabled",
            message: "GitHub connection is not enabled on this deployment.",
          },
          cache: "private, no-store",
        },
      ],
    });
  }, 20_000);

  it("omits callback JSON and provider errors with connections enabled [FR-100, SEC-007]", async () => {
    const serverUrl = new URL("../src/server.ts", import.meta.url).href;
    const script = `
      import { createStackLensApi } from ${JSON.stringify(serverUrl)};
      import { GitHubConnectionService } from '@stacklens/github-auth';
      const service = new GitHubConnectionService({ async save() {}, async find() {}, async remove() {}, async purgeExpired() { return 0; } }, {
        clientId: 'Iv1.synthetic', clientSecret: 'synthetic-client-secret', publicOrigin: 'https://stacklens.example',
        callbackUrl: 'https://relay.example/v1/auth/github/callback', sessionKey: '12'.repeat(32),
        installationUrl: 'https://github.com/apps/stacklens-test/installations/new',
      }, async () => { throw new Error('synthetic-provider-error'); });
      const app = await createStackLensApi({ logger: true, githubConnections: service,
        repository: {}, deliveryDispatcher: { async dispatchReady() {} } });
      const start = service.begin();
      const state = new URL(start.location).searchParams.get('state');
      try {
        const response = await app.inject({ method: 'POST', url: '/v1/auth/github/callback',
          headers: { origin: 'https://stacklens.example', cookie: '__Host-stacklens_oauth=' + start.stateCookie },
          payload: { code: 'synthetic-private-callback-code', state } });
        const malformed = await app.inject({ method: 'POST', url: '/v1/auth/github/callback',
          headers: { origin: 'https://stacklens.example', 'content-type': 'application/json' },
          payload: '{"code":"synthetic-malformed-secret"' });
        console.log(JSON.stringify({ receipt: true, status: response.statusCode, invalid: malformed.statusCode,
          body: response.json(), cleared: String(response.headers['set-cookie']).includes('Max-Age=0') }));
      } finally { await app.close(); }
    `;
    const result = await execute(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { timeout: 15_000 },
    );
    for (const marker of [
      "synthetic-private-callback-code",
      "synthetic-malformed-secret",
      "synthetic-provider-error",
      "synthetic-client-secret",
      "ghu_",
    ])
      expect(result.stdout + result.stderr).not.toContain(marker);
    const receipt: unknown = result.stdout
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as unknown)
      .find((item) => typeof item === "object" && item !== null && "receipt" in item);
    expect(receipt).toEqual({
      receipt: true,
      status: 400,
      invalid: 400,
      cleared: true,
      body: {
        code: "connection_failed",
        message: "GitHub connection could not be completed. Start again from StackLens.",
      },
    });
  }, 20_000);
});
