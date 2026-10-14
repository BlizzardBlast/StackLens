import { once } from "node:events";
import { createServer } from "node:http";

import { describe, expect, it, vi } from "vitest";

import {
  GitHubConfigurationError,
  GitHubRepositoryAdapter,
  NpmRegistryAdapter,
  OsvVulnerabilityAdapter,
} from "../src/index.js";

const repositoryUrl = "https://github.com/StackLensFixture/example-repository";
const bodyDetail = "synthetic provider details must not appear in failure summaries";
const cases = [
  { provider: "connected-github", status: 401, code: undefined },
  { provider: "connected-github", status: 403, code: undefined },
  { provider: "connected-github", status: 404, code: undefined },
  { provider: "public-github", status: 429, code: "github_repository_rate_limited" },
  { provider: "public-github", status: 503, code: "github_repository_http_503" },
  { provider: "npm", status: 429, code: "npm_http_429" },
  { provider: "npm", status: 503, code: "npm_http_503" },
  { provider: "osv", status: 429, code: "osv_query_http_429" },
  { provider: "osv", status: 503, code: "osv_query_http_503" },
] as const;

function requestProvider(provider: (typeof cases)[number]["provider"], fetchImpl: typeof fetch) {
  const options = { fetchImpl, timeoutMs: 2_000, maxResponseBytes: 1_024 };
  if (provider === "npm")
    return new NpmRegistryAdapter(options).fetch({ packageName: "synthetic-package" });
  if (provider === "osv")
    return new OsvVulnerabilityAdapter(options).fetch({
      queries: [{ packageName: "synthetic-package", version: "1.0.0" }],
    });
  return new GitHubRepositoryAdapter({
    ...options,
    ...(provider === "connected-github"
      ? { authorizedAccess: { repositoryUrl, getToken: async () => "synthetic-token" } }
      : {}),
  }).fetch({ repositoryUrl });
}

describe("FR-003/006/011/100, SEC-007, NFR-008/009 provider response cleanup", () => {
  it.each(cases)(
    "closes a stalled $provider HTTP $status body after safe failure",
    async (test) => {
      let responseClosed = false;
      const server = createServer((request, response) => {
        request.resume();
        response.once("close", () => {
          responseClosed = true;
        });
        response.writeHead(test.status, { "content-type": "application/json" });
        // Send headers/body bytes but never finish: cleanup must not depend on provider EOF or GC.
        response.write(bodyDetail);
      });
      try {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        if (address === null || typeof address === "string")
          throw new Error("Owned HTTP fixture has no local port.");
        let providerResponse: Response | undefined;
        // Every production provider URL is redirected by this injected fetch to this owned fixture.
        const fetchImpl: typeof fetch = async (_input, init) => {
          providerResponse = await fetch(`http://127.0.0.1:${address.port}/`, init);
          return providerResponse;
        };
        const outcome = await requestProvider(test.provider, fetchImpl).then(
          (result) => ({
            classification: result.ok ? "unexpected_success" : result.failure.code,
            authorizationDenied: false,
            description: JSON.stringify(result),
          }),
          (error: unknown) => ({
            classification:
              error instanceof GitHubConfigurationError
                ? "connected_access_denied"
                : "unexpected_error",
            authorizationDenied: error instanceof GitHubConfigurationError,
            description: String(error),
          }),
        );
        expect(outcome).toMatchObject({
          classification: test.code ?? "connected_access_denied",
          authorizationDenied: test.provider === "connected-github",
        });
        expect(outcome.description).not.toContain(bodyDetail);
        // Observe the actual socket response closing, rather than merely checking an abort flag.
        await vi.waitFor(() => expect(responseClosed).toBe(true), { timeout: 1_000, interval: 10 });
        // Retain the response through this assertion so GC cannot stand in for adapter cleanup.
        expect(providerResponse?.body).toBeInstanceOf(ReadableStream);
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
          server.closeAllConnections();
        });
      }
    },
  );
});
