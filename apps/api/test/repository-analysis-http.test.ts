import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";
import { GitHubConnectionService } from "@stacklens/github-auth";
import type { StoredGitHubConnection } from "@stacklens/persistence";
import type {
  AnalysisRepository,
  RepositoryAnalysisRecord,
  StoredAnalysisReport,
} from "@stacklens/persistence";
import type { RepositoryAnalysisDeliveryDispatcher } from "@stacklens/repository-jobs";

import { createStackLensApi } from "../src/index.js";

const createdAt = "2026-09-21T12:00:00.000Z";

function record(overrides: Partial<RepositoryAnalysisRecord> = {}): RepositoryAnalysisRecord {
  return {
    id: "analysis-test-001",
    inputType: "repository",
    repositoryUrl: "https://github.com/acme/demo",
    status: "queued",
    progressStage: "queued",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function availableScore() {
  return {
    status: "available" as const,
    value: 100,
    evidenceCoverage: 100,
    contributionIds: [],
  };
}

function report(analysisId: string): AnalysisReport {
  return {
    schemaVersion: "1.0.0",
    analysisId,
    createdAt,
    input: {
      type: "repository",
      fingerprint: "github:acme/demo@0123456789abcdef0123456789abcdef01234567",
      repository: {
        provider: "github",
        owner: "acme",
        name: "demo",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
        ref: "main",
      },
    },
    analyzer: {
      version: "javascript-production-v1",
      ruleSetVersion: "javascript-rules-v1",
      scoringVersion: "stack-health-v1",
    },
    sources: [],
    evidence: [],
    facts: [],
    findings: [],
    recommendations: [],
    scores: {
      overall: availableScore(),
      categories: {
        dependencies: availableScore(),
        security: availableScore(),
        maintainability: availableScore(),
        testing: availableScore(),
        tooling: availableScore(),
      },
      contributions: [],
    },
    limitations: [],
    partialFailures: [],
  };
}

function repositoryHarness(
  initialAnalysis?: RepositoryAnalysisRecord,
  initialReport?: StoredAnalysisReport,
) {
  let currentAnalysis = initialAnalysis;
  let currentReport = initialReport;

  const createQueuedRepositoryAnalysis = vi.fn<
    AnalysisRepository["createQueuedRepositoryAnalysis"]
  >(async (input) => {
    currentAnalysis = record({
      id: input.id,
      repositoryUrl: input.repositoryUrl,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      ...(input.requestedRef === undefined ? {} : { requestedRef: input.requestedRef }),
      ...(input.ownerGithubId === undefined ? {} : { ownerGithubId: input.ownerGithubId }),
      ...(input.githubConnectionId === undefined
        ? {}
        : { githubConnectionId: input.githubConnectionId }),
    });

    return currentAnalysis;
  });
  const createQueuedRepositoryAnalysisWithDelivery = vi.fn<
    AnalysisRepository["createQueuedRepositoryAnalysisWithDelivery"]
  >(async (input) => createQueuedRepositoryAnalysis(input));
  const claimPendingRepositoryAnalysisDeliveries = vi.fn<
    AnalysisRepository["claimPendingRepositoryAnalysisDeliveries"]
  >(async () => []);
  const markRepositoryAnalysisDeliveryDelivered = vi.fn<
    AnalysisRepository["markRepositoryAnalysisDeliveryDelivered"]
  >(async () => undefined);
  const retryRepositoryAnalysisDelivery = vi.fn<
    AnalysisRepository["retryRepositoryAnalysisDelivery"]
  >(async () => undefined);
  const findAnalysis = vi.fn<AnalysisRepository["findAnalysis"]>(async (id) =>
    currentAnalysis?.id === id ? currentAnalysis : undefined,
  );
  const findReport = vi.fn<AnalysisRepository["findReport"]>(async (analysisId) =>
    currentReport?.analysisId === analysisId ? currentReport : undefined,
  );
  const claimForExecution = vi.fn<AnalysisRepository["claimForExecution"]>(async () => false);
  const updateProgress = vi.fn<AnalysisRepository["updateProgress"]>(async () => undefined);
  const markRetryPending = vi.fn<AnalysisRepository["markRetryPending"]>(async () => undefined);
  const complete = vi.fn<AnalysisRepository["complete"]>(async () => undefined);
  const fail = vi.fn<AnalysisRepository["fail"]>(async () => undefined);

  const repository: AnalysisRepository = {
    createQueuedRepositoryAnalysis,
    createQueuedRepositoryAnalysisWithDelivery,
    claimPendingRepositoryAnalysisDeliveries,
    markRepositoryAnalysisDeliveryDelivered,
    retryRepositoryAnalysisDelivery,
    findAnalysis,
    findReport,
    claimForExecution,
    updateProgress,
    markRetryPending,
    complete,
    fail,
  };

  return {
    repository,
    createQueuedRepositoryAnalysis,
    createQueuedRepositoryAnalysisWithDelivery,
    findAnalysis,
    findReport,
    setAnalysis(value: RepositoryAnalysisRecord | undefined) {
      currentAnalysis = value;
    },
    setReport(value: StoredAnalysisReport | undefined) {
      currentReport = value;
    },
  };
}

function deliveryDispatcherHarness(error?: Error) {
  const dispatchReady = vi.fn<RepositoryAnalysisDeliveryDispatcher["dispatchReady"]>(async () => {
    if (error !== undefined) {
      throw error;
    }
  });

  return {
    dispatchReady,
    deliveryDispatcher: { dispatchReady } satisfies RepositoryAnalysisDeliveryDispatcher,
  };
}

const openApps: FastifyInstance[] = [];

describe("GitHub connection transport [FR-100, SEC-003, SEC-005, SEC-007]", () => {
  async function callbackHarness() {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error("Authorization errors must not contact GitHub.");
    });
    const save = vi.fn<(row: StoredGitHubConnection) => Promise<void>>(async () => {});
    const service = new GitHubConnectionService(
      {
        save,
        async find() {
          return undefined;
        },
        async remove() {},
        async purgeExpired() {
          return 0;
        },
      },
      {
        clientId: "Iv1.test",
        clientSecret: "synthetic-client-secret",
        sessionKey: "12".repeat(32),
        publicOrigin: "https://stacklens.example",
        callbackUrl: "https://relay.example/v1/auth/github/callback",
        installationUrl: "https://github.com/apps/stacklens-test/installations/new",
      },
      fetchImpl,
    );
    const app = await createStackLensApi({
      repository: repositoryHarness().repository,
      deliveryDispatcher: deliveryDispatcherHarness().deliveryDispatcher,
      githubConnections: service,
    });
    openApps.push(app);
    const started = await app.inject({ method: "GET", url: "/v1/auth/github/start" });
    expect(started.statusCode).toBe(302);
    const state = new URL(String(started.headers.location)).searchParams.get("state") ?? "";
    const cookie = String(started.headers["set-cookie"]).split(";")[0] ?? "";
    return { app, state, cookie, fetchImpl, save };
  }

  it.each([
    {
      error: "access_denied",
      errorUri:
        "https://docs.github.com/apps/oauth-apps/maintaining-oauth-apps/troubleshooting-authorization-request-errors/#access-denied",
    },
    {
      error: "application_suspended",
      errorUri:
        "/apps/building-integrations/setting-up-and-registering-oauth-apps/troubleshooting-authorization-request-errors/#application-suspended",
    },
    { error: "redirect_uri_mismatch", errorUri: "https://untrusted.invalid/synthetic-error-uri" },
  ])(
    "handles $error with provider error_uri without granting access [FR-100, SEC-007]",
    async ({ error, errorUri }) => {
      const { app, state, cookie, fetchImpl, save } = await callbackHarness();
      const query = new URLSearchParams({
        error,
        state,
        error_description: "synthetic-provider-detail",
        error_uri: errorUri,
      });
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/github/callback",
        headers: { cookie, origin: "https://stacklens.example" },
        payload: Object.fromEntries(query),
      });
      expect(response.statusCode).toBe(400);
      expect(response.headers.location).toBeUndefined();
      expect(response.headers["set-cookie"]).toBe(
        "__Host-stacklens_oauth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure",
      );
      expect(response.headers["referrer-policy"]).toBe("no-referrer");
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.body).not.toContain(errorUri);
      expect(response.body).not.toContain("synthetic-provider-detail");
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each(["oversized error_uri", "unknown query field"] as const)(
    "rejects %s before provider I/O [FR-100, SEC-007]",
    async (invalid) => {
      const { app, state, cookie, fetchImpl, save } = await callbackHarness();
      const query = new URLSearchParams({ error: "access_denied", state });
      query.set(
        invalid === "oversized error_uri" ? "error_uri" : "unsupported",
        invalid === "oversized error_uri" ? "x".repeat(2_001) : "synthetic-value",
      );
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/github/callback",
        headers: { cookie, origin: "https://stacklens.example" },
        payload: Object.fromEntries(query),
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        code: "invalid_request",
        message: "Request does not match the API schema.",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("publishes bounded optional authorization-error metadata in OpenAPI [FR-100, NFR-005]", async () => {
    const { app } = await callbackHarness();
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      paths: {
        "/v1/auth/github/callback": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    properties: { error_uri: { type: "string", maxLength: 2_000 } },
                    additionalProperties: false,
                  },
                },
              },
            },
            responses: { "200": {}, "400": {}, "403": {}, "503": {} },
          },
          get: { deprecated: true, responses: { "410": {} } },
        },
      },
    });
  });

  it.each([
    undefined,
    "null",
    "https://evil.example",
    "https://stacklens.example.evil.invalid",
    "https://stacklens.example",
  ])(
    "rejects callback Origin %s or cross-site metadata before parsing/cleanup/I/O [FR-100, SEC-007]",
    async (origin) => {
      const { app, cookie, fetchImpl, save } = await callbackHarness();
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/github/callback",
        headers: {
          cookie,
          "content-type": "application/json",
          ...(origin ? { origin } : {}),
          ...(origin === "https://stacklens.example" ? { "sec-fetch-site": "cross-site" } : {}),
        },
        payload: "{",
      });
      expect(response.statusCode).toBe(403);
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each([
    "malformed JSON",
    "oversized body",
    "query values",
    "unknown body",
    "missing state",
    "wrong state",
    "provider failure",
  ])(
    "clears trusted pending state for %s without leaking callback fields [FR-100, SEC-007]",
    async (invalid) => {
      const { app, state, cookie, fetchImpl, save } = await callbackHarness();
      const response = await app.inject({
        method: "POST",
        url:
          invalid === "query values"
            ? "/v1/auth/github/callback?code=synthetic-query"
            : "/v1/auth/github/callback",
        headers: {
          cookie,
          origin: "https://stacklens.example",
          "content-type": "application/json",
        },
        payload:
          invalid === "malformed JSON"
            ? "{"
            : invalid === "oversized body"
              ? "x".repeat(8_193)
              : {
                  code: "synthetic-code",
                  ...(invalid === "missing state"
                    ? {}
                    : { state: invalid === "wrong state" ? "other" : state }),
                  ...(invalid === "unknown body" ? { redirect: "https://evil.example" } : {}),
                },
      });
      expect(response.statusCode).toBe(400);
      expect(response.headers["set-cookie"]).toContain("Max-Age=0");
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.body).not.toContain("synthetic-code");
      expect(response.body).not.toContain(state);
      expect(response.headers.location).toBeUndefined();
      expect(fetchImpl).toHaveBeenCalledTimes(invalid === "provider failure" ? 1 : 0);
      expect(save).not.toHaveBeenCalled();
    },
  );

  it("rejects the legacy GET without exchanging codes or clearing cookies [FR-100, SEC-007]", async () => {
    const { app, state, cookie, fetchImpl } = await callbackHarness();
    const response = await app.inject({
      method: "GET",
      url: `/v1/auth/github/callback?code=synthetic&state=${state}`,
      headers: { cookie },
    });
    expect(response.statusCode).toBe(410);
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(response.body).not.toContain(state);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("protects callback cookies and rejects CSRF/foreign owners before any report read", async () => {
    const rows = new Map<string, StoredGitHubConnection>();
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      (input instanceof Request ? input.url : input instanceof URL ? input.href : input).includes(
        "access_token",
      )
        ? Response.json({
            access_token: "ghu_syntheticTestToken0123456789",
            token_type: "bearer",
            scope: "",
            expires_in: 28800,
          })
        : (input instanceof Request
              ? input.url
              : input instanceof URL
                ? input.href
                : input
            ).endsWith("/user")
          ? Response.json({ id: 123, login: "alice" })
          : Response.json({ private: true, name: "demo", owner: { login: "acme" } }),
    );
    const service = new GitHubConnectionService(
      {
        async save(row) {
          rows.set(row.sessionHash, row);
        },
        async find(id) {
          return rows.get(id);
        },
        async remove(id) {
          rows.delete(id);
        },
        async purgeExpired() {
          return 0;
        },
      },
      {
        clientId: "Iv1.test",
        clientSecret: "synthetic-client-secret",
        sessionKey: "12".repeat(32),
        publicOrigin: "https://stacklens.example",
        callbackUrl: "https://relay.example/v1/auth/github/callback",
        installationUrl: "https://github.com/apps/stacklens-test/installations/new",
      },
      fetchImpl,
      () => Date.parse(createdAt),
    );
    const h = repositoryHarness(),
      jobs = deliveryDispatcherHarness();
    const app = await createStackLensApi({
      repository: h.repository,
      deliveryDispatcher: jobs.deliveryDispatcher,
      githubConnections: service,
      createAnalysisId: () => "analysis-test-001",
      now: () => createdAt,
    });
    openApps.push(app);
    const start = await app.inject({ method: "GET", url: "/v1/auth/github/start" });
    expect(start.statusCode).toBe(302);
    const state = new URL(String(start.headers.location)).searchParams.get("state");
    const pending = String(start.headers["set-cookie"]).split(";")[0] ?? "";
    expect(pending).toMatch(/^__Host-stacklens_oauth=/u);
    expect(start.headers["set-cookie"]).toContain("HttpOnly; SameSite=Lax");
    expect(start.headers["set-cookie"]).toContain("Secure");
    const callback = await app.inject({
      method: "POST",
      url: "/v1/auth/github/callback",
      headers: { cookie: pending, origin: "https://stacklens.example" },
      payload: { code: "synthetic-code", state },
    });
    expect(callback.statusCode).toBe(200);
    expect(callback.json()).toEqual({ connected: true });
    const cookies = callback.headers["set-cookie"];
    const sessionCookie =
      (Array.isArray(cookies) ? cookies : [String(cookies)])
        .find((value) => value.startsWith("__Host-stacklens_session="))
        ?.split(";")[0] ?? "";
    expect(sessionCookie).not.toBe("");
    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: sessionCookie },
    });
    const session = response.json<{ csrfToken: string; user: { login: string } }>();
    expect(session.user.login).toBe("alice");
    expect(response.body).not.toContain("ghu_");
    expect(response.body).not.toContain("connectionId");
    const headers = {
      cookie: sessionCookie,
      origin: "https://stacklens.example",
      "x-stacklens-csrf": session.csrfToken,
    };
    const deniedSubmissions = await Promise.all(
      [
        { ...headers, origin: "https://evil.example" },
        { ...headers, "x-stacklens-csrf": "wrong" },
        { origin: headers.origin },
      ].map((invalid) =>
        app.inject({
          method: "POST",
          url: "/v1/analyses/github",
          headers: invalid,
          payload: { repositoryUrl: "https://github.com/acme/demo" },
        }),
      ),
    );
    expect(deniedSubmissions.map((result) => result.statusCode)).toEqual([403, 403, 403]);
    expect(h.createQueuedRepositoryAnalysisWithDelivery).not.toHaveBeenCalled();
    const accepted = await app.inject({
      method: "POST",
      url: "/v1/analyses/github",
      headers,
      payload: { repositoryUrl: "https://github.com/acme/demo" },
    });
    expect(accepted.statusCode).toBe(202);
    expect(h.createQueuedRepositoryAnalysisWithDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerGithubId: "123",
        retentionExpiresAt: "2026-09-22T12:00:00.000Z",
      }),
    );
    const privateRead = await app.inject({
      method: "GET",
      url: "/v1/analyses/analysis-test-001",
      headers,
    });
    expect(privateRead.json()).toMatchObject({ access: "connected" });
    const denied = await app.inject({ method: "GET", url: "/v1/analyses/analysis-test-001" });
    const absent = await app.inject({ method: "GET", url: "/v1/analyses/missing" });
    expect(denied.statusCode).toBe(404);
    expect(denied.body).toBe(absent.body);
    expect(h.findReport).not.toHaveBeenCalled();
    h.setAnalysis(
      record({
        ownerGithubId: "456",
        githubConnectionId: "ab".repeat(32),
        status: "completed",
        progressStage: "completed",
      }),
    );
    expect(
      (await app.inject({ method: "GET", url: "/v1/analyses/analysis-test-001", headers }))
        .statusCode,
    ).toBe(404);
    expect(h.findReport).not.toHaveBeenCalled();
    expect(
      (await app.inject({ method: "POST", url: "/v1/auth/sign-out", headers, payload: {} }))
        .statusCode,
    ).toBe(200);
    expect(rows.size).toBe(0);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/analyses/github",
          headers,
          payload: { repositoryUrl: "https://github.com/acme/demo" },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("keeps anonymous analysis available with connections disabled", async () => {
    const app = await testApi(
      repositoryHarness().repository,
      deliveryDispatcherHarness().deliveryDispatcher,
    );
    expect((await app.inject({ method: "GET", url: "/v1/auth/session" })).json()).toEqual({
      enabled: false,
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/analyses/github",
          payload: { repositoryUrl: "https://github.com/acme/demo" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/analyses/repository",
          payload: { repositoryUrl: "https://github.com/acme/demo" },
        })
      ).statusCode,
    ).toBe(202);
  });
});

afterEach(async () => {
  const apps = openApps.splice(0);
  await Promise.all(apps.map(async (app) => app.close()));
});

async function testApi(
  repository: AnalysisRepository,
  deliveryDispatcher: RepositoryAnalysisDeliveryDispatcher,
): Promise<FastifyInstance> {
  const app = await createStackLensApi({
    repository,
    deliveryDispatcher,
    createAnalysisId: () => "analysis-test-001",
    now: () => createdAt,
  });

  openApps.push(app);
  return app;
}

describe("repository analysis Fastify transport [FR-003, FR-004, NFR-008]", () => {
  it.each(["completed", "completed_with_limitations"] as const)(
    "SEC-003 returns 404 when retention removes a %s analysis between reads",
    async (status) => {
      const persistence = repositoryHarness(record({ status, progressStage: status }));
      persistence.findReport.mockImplementationOnce(async () => {
        persistence.setAnalysis(undefined);
        return undefined;
      });
      const jobs = deliveryDispatcherHarness();
      const app = await testApi(persistence.repository, jobs.deliveryDispatcher);
      const response = await app.inject({ method: "GET", url: "/v1/analyses/analysis-test-001" });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        code: "analysis_not_found",
        message: "Analysis was not found.",
      });
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.headers["cdn-cache-control"]).toBe("no-store");
      expect(response.headers["vercel-cdn-cache-control"]).toBe("no-store");
      expect(persistence.findAnalysis).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["completed", "completed_with_limitations"] as const)(
    "NFR-008 returns 503 while a %s report is missing and serves it on a later request",
    async (status) => {
      const persistence = repositoryHarness(record({ status, progressStage: status }));
      const jobs = deliveryDispatcherHarness();
      const app = await testApi(persistence.repository, jobs.deliveryDispatcher);
      const unavailable = await app.inject({
        method: "GET",
        url: "/v1/analyses/analysis-test-001",
      });
      expect(unavailable.statusCode).toBe(503);
      expect(unavailable.json()).toEqual({
        code: "analysis_unavailable",
        message: "Repository analysis is temporarily unavailable.",
      });
      expect(persistence.findAnalysis).toHaveBeenCalledTimes(2);

      const storedReport = report("analysis-test-001");
      persistence.setReport({
        analysisId: "analysis-test-001",
        reportSchemaVersion: storedReport.schemaVersion,
        report: storedReport,
        createdAt,
      });
      const recovered = await app.inject({ method: "GET", url: "/v1/analyses/analysis-test-001" });
      expect(recovered.statusCode).toBe(200);
      expect(recovered.json()).toMatchObject({
        status,
        progressStage: status,
        report: storedReport,
      });
      expect(persistence.findAnalysis).toHaveBeenCalledTimes(3);
      for (const response of [unavailable, recovered]) {
        expect(response.headers["cache-control"]).toBe("private, no-store");
        expect(response.headers["cdn-cache-control"]).toBe("no-store");
        expect(response.headers["vercel-cdn-cache-control"]).toBe("no-store");
      }
    },
  );

  it("NFR-008 returns refreshed progress when the terminal record changes between reads", async () => {
    const persistence = repositoryHarness(
      record({ status: "completed", progressStage: "completed" }),
    );
    persistence.findReport.mockImplementationOnce(async () => {
      persistence.setAnalysis(record({ status: "running", progressStage: "resolving_repository" }));
      return undefined;
    });
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);
    const response = await app.inject({ method: "GET", url: "/v1/analyses/analysis-test-001" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "running",
      progressStage: "resolving_repository",
    });
    expect(response.json()).not.toHaveProperty("report");
    expect(persistence.findAnalysis).toHaveBeenCalledTimes(2);
    expect(persistence.findReport).toHaveBeenCalledOnce();
  });

  it.each(["report", "recheck"] as const)(
    "NFR-009 returns a sanitized 503 when the terminal %s lookup fails",
    async (lookup) => {
      const persistence = repositoryHarness(
        record({ status: "completed", progressStage: "completed" }),
      );
      const privateFailure = new Error("synthetic private database detail");
      if (lookup === "report") {
        persistence.findReport.mockRejectedValueOnce(privateFailure);
      } else {
        persistence.findAnalysis.mockResolvedValueOnce(
          record({ status: "completed", progressStage: "completed" }),
        );
        persistence.findAnalysis.mockRejectedValueOnce(privateFailure);
      }
      const jobs = deliveryDispatcherHarness();
      const app = await testApi(persistence.repository, jobs.deliveryDispatcher);
      const response = await app.inject({ method: "GET", url: "/v1/analyses/analysis-test-001" });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        code: "analysis_unavailable",
        message: "Repository analysis is temporarily unavailable.",
      });
      expect(response.body).not.toContain(privateFailure.message);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.headers["cdn-cache-control"]).toBe("no-store");
      expect(response.headers["vercel-cdn-cache-control"]).toBe("no-store");
    },
  );
  it("SEC-003 assigns configured expiry and prevents caching of accepted and failed requests", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness();
    const app = await createStackLensApi({
      repository: persistence.repository,
      deliveryDispatcher: jobs.deliveryDispatcher,
      createAnalysisId: () => "retention-test",
      now: () => createdAt,
      retentionHours: 24,
    });
    openApps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: { repositoryUrl: "https://github.com/acme/demo" },
    });
    expect(response.statusCode).toBe(202);
    expect(persistence.createQueuedRepositoryAnalysisWithDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        retentionExpiresAt: new Date(new Date(createdAt).getTime() + 86_400_000).toISOString(),
      }),
    );
    const missing = await app.inject({ method: "GET", url: "/v1/analyses/missing" });
    expect(missing.statusCode).toBe(404);
    for (const result of [response, missing]) {
      expect(result.headers["cache-control"]).toBe("private, no-store");
      expect(result.headers["cdn-cache-control"]).toBe("no-store");
      expect(result.headers["vercel-cdn-cache-control"]).toBe("no-store");
    }
  });
  it("validates, canonicalizes, and durably accepts repository work before best-effort dispatch", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo.git/",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      analysisId: "analysis-test-001",
    });
    expect(persistence.createQueuedRepositoryAnalysisWithDelivery).toHaveBeenCalledWith({
      id: "analysis-test-001",
      repositoryUrl: "https://github.com/acme/demo",
      createdAt,
    });
    expect(jobs.dispatchReady).toHaveBeenCalledOnce();
  });

  it("rejects unsupported repository URLs and unknown request fields before durable work", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const unsupported = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://example.com/acme/demo",
      },
    });
    const extraField = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo",
        source: "must-not-be-accepted",
      },
    });

    expect(unsupported.statusCode).toBe(400);
    expect(unsupported.json()).toEqual({
      code: "invalid_repository_url",
      message: "repositoryUrl must be a public HTTPS GitHub repository URL.",
    });
    expect(extraField.statusCode).toBe(400);
    expect(extraField.json()).toEqual({
      code: "invalid_request",
      message: "Request does not match the API schema.",
    });
    expect(persistence.createQueuedRepositoryAnalysisWithDelivery).not.toHaveBeenCalled();
    expect(jobs.dispatchReady).not.toHaveBeenCalled();
  });

  it("accepts durable work while the outbox retries a delivery failure", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness(new Error("synthetic delivery failure"));
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      analysisId: "analysis-test-001",
    });
    expect(persistence.createQueuedRepositoryAnalysisWithDelivery).toHaveBeenCalledOnce();
    expect(jobs.dispatchReady).toHaveBeenCalledOnce();
  });

  it("FR-003 awaits the atomic commit but returns 202 without waiting for best-effort dispatch", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness();
    const durableCreation = Promise.withResolvers<RepositoryAnalysisRecord>();
    const delivery = Promise.withResolvers<void>();
    persistence.createQueuedRepositoryAnalysisWithDelivery.mockReturnValueOnce(
      durableCreation.promise,
    );
    jobs.dispatchReady.mockReturnValueOnce(delivery.promise);
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);
    let responseSettled = false;
    const responsePromise = app
      .inject({
        method: "POST",
        url: "/v1/analyses/repository",
        payload: { repositoryUrl: "https://github.com/acme/demo" },
      })
      .then((response) => {
        responseSettled = true;
        return response;
      });

    try {
      await vi.waitFor(() =>
        expect(persistence.createQueuedRepositoryAnalysisWithDelivery).toHaveBeenCalledOnce(),
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(responseSettled).toBe(false);
      expect(jobs.dispatchReady).not.toHaveBeenCalled();

      durableCreation.resolve(record());
      await vi.waitFor(() => expect(responseSettled).toBe(true));
      const response = await responsePromise;
      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({ analysisId: "analysis-test-001" });
      expect(jobs.dispatchReady).toHaveBeenCalledOnce();
    } finally {
      durableCreation.resolve(record());
      delivery.resolve();
      await responsePromise;
    }
  });

  it("returns a stable availability error when durable creation fails", async () => {
    const persistence = repositoryHarness();
    persistence.createQueuedRepositoryAnalysisWithDelivery.mockRejectedValue(
      new Error("synthetic persistence failure"),
    );
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "POST",
      url: "/v1/analyses/repository",
      payload: {
        repositoryUrl: "https://github.com/acme/demo",
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      code: "analysis_unavailable",
      message: "Repository analysis is temporarily unavailable.",
    });
    expect(response.body).not.toContain("synthetic persistence failure");
    expect(response.body).not.toContain("analysis-test-001");
    expect(jobs.dispatchReady).not.toHaveBeenCalled();
  });

  it("returns durable running progress without exposing queue internals", async () => {
    const persistence = repositoryHarness(
      record({
        status: "running",
        progressStage: "collecting_metadata",
        startedAt: "2026-09-21T12:00:01.000Z",
        updatedAt: "2026-09-21T12:00:02.000Z",
      }),
    );
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/analysis-test-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      analysisId: "analysis-test-001",
      repositoryUrl: "https://github.com/acme/demo",
      status: "running",
      progressStage: "collecting_metadata",
      createdAt,
      startedAt: "2026-09-21T12:00:01.000Z",
      updatedAt: "2026-09-21T12:00:02.000Z",
    });
    expect(persistence.findReport).not.toHaveBeenCalled();
    expect(persistence.findAnalysis).toHaveBeenCalledOnce();
    expect(response.body).not.toContain("job");
  });

  it.each(["1.0.0", "2.0.0"] as const)(
    "returns the stored schema %s unchanged for completed repository analysis",
    async (schemaVersion) => {
      const completedAt = "2026-09-21T12:00:05.000Z";
      const legacy = report("analysis-test-001");
      const score = {
        status: "not_applicable" as const,
        scope: "Synthetic empty scope",
        rationale: "No applicable checks in this fixture.",
        checkCounts: { passed: 0, failed: 0, unknown: 0, notApplicable: 0 },
        checkFactIds: [],
      };
      const analysisReport: AnalysisReport =
        schemaVersion === "1.0.0"
          ? legacy
          : {
              ...legacy,
              schemaVersion,
              analyzer: {
                version: "javascript-production-v4",
                ruleSetVersion: "javascript-rules-v4",
                scoringVersion: "stack-health-v3",
              },
              scores: {
                overall: score,
                categories: {
                  dependencies: score,
                  security: score,
                  maintainability: score,
                  testing: score,
                  tooling: score,
                },
                contributions: [],
              },
            };
      const persistence = repositoryHarness(
        record({
          status: "completed",
          progressStage: "completed",
          startedAt: "2026-09-21T12:00:01.000Z",
          completedAt,
          updatedAt: completedAt,
        }),
        {
          analysisId: "analysis-test-001",
          reportSchemaVersion: schemaVersion,
          report: analysisReport,
          createdAt: completedAt,
        },
      );
      const jobs = deliveryDispatcherHarness();
      const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

      const response = await app.inject({
        method: "GET",
        url: "/v1/analyses/analysis-test-001",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        analysisId: "analysis-test-001",
        status: "completed",
        progressStage: "completed",
        completedAt,
        report: analysisReport,
      });
      expect(persistence.findReport).toHaveBeenCalledWith("analysis-test-001");
      expect(persistence.findAnalysis).toHaveBeenCalledOnce();
    },
  );

  it("returns typed terminal failure and does not expose a report", async () => {
    const completedAt = "2026-09-21T12:00:05.000Z";
    const persistence = repositoryHarness(
      record({
        status: "failed",
        progressStage: "failed",
        completedAt,
        updatedAt: completedAt,
        failureSummary: {
          code: "repository_not_found",
          message: "The public repository could not be resolved.",
          retryable: false,
        },
      }),
    );
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/analysis-test-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      analysisId: "analysis-test-001",
      status: "failed",
      progressStage: "failed",
      failure: {
        code: "repository_not_found",
        message: "The public repository could not be resolved.",
        retryable: false,
      },
    });
    expect(response.json()).not.toHaveProperty("report");
    expect(persistence.findReport).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown analysis identifier", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "GET",
      url: "/v1/analyses/missing-analysis",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "analysis_not_found",
      message: "Analysis was not found.",
    });
    expect(persistence.findAnalysis).toHaveBeenCalledOnce();
    expect(persistence.findReport).not.toHaveBeenCalled();
  });

  it("publishes the repository analysis polling contract through OpenAPI", async () => {
    const persistence = repositoryHarness();
    const jobs = deliveryDispatcherHarness();
    const app = await testApi(persistence.repository, jobs.deliveryDispatcher);

    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"1.0.0"');
    expect(response.body).toContain('"2.0.0"');
    expect(response.json()).toMatchObject({
      openapi: "3.1.0",
      paths: {
        "/v1/analyses/repository": {
          post: {
            operationId: "createRepositoryAnalysis",
            responses: {
              "202": {},
              "400": {},
              "503": {},
            },
          },
        },
        "/v1/analyses/{analysisId}": {
          get: {
            operationId: "getRepositoryAnalysis",
            responses: {
              "200": {},
              "400": {},
              "404": {},
              "503": {},
            },
          },
        },
      },
    });
  });
});
