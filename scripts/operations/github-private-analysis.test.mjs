// FR-100/003/017/021/022, SEC-003/004/005/007: real restricted login and durable private pipeline; all provider I/O synthetic.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";

import { createStackLensApi } from "../../apps/api/dist/index.js";
import {
  createRepositoryAnalysisTaskList,
  startStackLensWorker,
} from "../../apps/worker/dist/index.js";
import { createWorkerAnalysisDependencies } from "../../apps/worker/dist/providers.js";
import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import {
  GitHubConnectionService,
  connectedGitHubToken,
} from "../../packages/github-auth/dist/index.js";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
  DrizzleGitHubConnectionStore,
  migrateStackLensDatabase,
  verifyConnectedApiDatabase,
} from "../../packages/persistence/dist/index.js";
import { cleanupSteps, requireLocalDatabase, until } from "./common.mjs";
import { capacityFetch, capacityRepositoryUrl } from "./worker-capacity-fixtures.mjs";

await test(
  "FR-100: real restricted API login delivers private work, preserves owner-only results and ends access on sign-out",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const original = requireLocalDatabase(process.env.TEST_DATABASE_URL);
    const name = `stacklens_github_${randomUUID().replaceAll("-", "")}`;
    const role = `stacklens_github_api_${randomUUID().replaceAll("-", "")}`;
    const password = randomBytes(24).toString("hex"),
      key = randomBytes(32).toString("hex");
    const token = "ghu_syntheticPrivatePipelineToken0123456789";
    const admin = createStackLensPool(original.toString(), undefined, { max: 1 });
    let sourceCreated = false,
      roleCreated = false,
      pool,
      apiPool,
      api,
      worker,
      error;
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      sourceCreated = true;
      const creation = await admin.query(
        "SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', $1::text, $2::text) AS command",
        [role, password],
      );
      await admin.query(creation.rows[0].command);
      roleCreated = true;
      original.pathname = `/${name}`;
      pool = createStackLensPool(original.toString(), undefined, { max: 2 });
      await migrateStackLensDatabase(createStackLensDatabase(pool));
      await pool.query(`GRANT USAGE ON SCHEMA public, stacklens_auth TO "${role}"`);
      await pool.query(`GRANT SELECT ON analysis, analysis_report, analysis_delivery TO "${role}"`);
      await pool.query(`GRANT INSERT ON analysis, analysis_delivery TO "${role}"`);
      await pool.query(
        `GRANT SELECT, INSERT, DELETE ON stacklens_auth.github_connection TO "${role}"`,
      );
      const restrictedUrl = new URL(original);
      restrictedUrl.username = role;
      restrictedUrl.password = password;
      apiPool = createStackLensPool(restrictedUrl.toString(), undefined, { max: 2 });
      await verifyConnectedApiDatabase(createStackLensDatabase(apiPool));
      const repository = new DrizzleAnalysisRepository(createStackLensDatabase(pool));
      const store = new DrizzleGitHubConnectionStore(createStackLensDatabase(pool));
      let githubReads = 0;
      const providerFetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : input);
        const headers = new Headers(init?.headers);
        if (url.hostname === "api.github.com") {
          assert.equal(headers.get("authorization"), `Bearer ${token}`);
          githubReads++;
        } else assert.equal(headers.has("authorization"), false);
        if (url.hostname === "registry.npmjs.org") {
          const packageName = decodeURIComponent(url.pathname.slice(1));
          assert.match(packageName, /^capacity-package-[0-7]$/u);
          // Exercise authentication/orchestration; the independent capacity test owns large transport buffers.
          return Response.json({
            name: packageName,
            "dist-tags": { latest: "1.1.0" },
            versions: { "1.0.0": { version: "1.0.0" }, "1.1.0": { version: "1.1.0" } },
          });
        }
        const response = await capacityFetch(input, init);
        return url.href === "https://api.github.com/repos/acme/capacity-fixture"
          ? Response.json({ ...(await response.json()), private: true })
          : response;
      };
      worker = await startStackLensWorker({
        connectionString: original.toString(),
        concurrency: 1,
        retentionCleanup: false,
        taskList: createRepositoryAnalysisTaskList({
          repository,
          analysisDependencies: createWorkerAnalysisDependencies(
            new AbortController().signal,
            undefined,
            providerFetch,
          ),
          createConnectedAnalysisDependencies(analysis, signal) {
            return createWorkerAnalysisDependencies(signal, undefined, providerFetch, {
              repositoryUrl: analysis.repositoryUrl,
              getToken: () =>
                connectedGitHubToken(
                  store,
                  key,
                  analysis.ownerGithubId,
                  analysis.githubConnectionId,
                ),
            });
          },
        }),
      });
      const service = new GitHubConnectionService(
        new DrizzleGitHubConnectionStore(createStackLensDatabase(apiPool)),
        {
          publicOrigin: "https://stacklens.fixture",
          installationUrl: "https://github.com/apps/stacklens-fixture/installations/new",
          clientId: "Iv1.fixture",
          callbackUrl: "https://relay.example/v1/auth/github/callback",
          clientSecret: "synthetic-client-secret",
          sessionKey: key,
        },
        async (input) => {
          const url = new URL(input instanceof Request ? input.url : input);
          if (url.href === "https://github.com/login/oauth/access_token")
            return Response.json({
              access_token: token,
              token_type: "bearer",
              scope: "",
              expires_in: 28800,
            });
          if (url.href === "https://api.github.com/user")
            return Response.json({ id: 123, login: "alice" });
          assert.equal(url.href, "https://api.github.com/repos/acme/capacity-fixture");
          return Response.json({
            private: true,
            name: "capacity-fixture",
            owner: { login: "acme" },
          });
        },
      );
      api = await createStackLensApi({
        repository: new DrizzleAnalysisRepository(createStackLensDatabase(apiPool)),
        deliveryDispatcher: { async dispatchReady() {} },
        githubConnections: service,
        retentionHours: 24,
      });
      const start = await api.inject({ method: "GET", url: "/v1/auth/github/start" });
      const state = new URL(start.headers.location).searchParams.get("state");
      const callback = await api.inject({
        method: "POST",
        url: "/v1/auth/github/callback",
        headers: {
          cookie: String(start.headers["set-cookie"]).split(";")[0],
          origin: "https://stacklens.fixture",
        },
        payload: { state, code: "synthetic" },
      });
      assert.equal(callback.statusCode, 200);
      assert.deepEqual(callback.json(), { connected: true });
      const cookie = callback.headers["set-cookie"]
        .find((value) => value.startsWith("__Host-stacklens_session="))
        .split(";")[0];
      const session = (
        await api.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } })
      ).json();
      const headers = {
        cookie,
        origin: "https://stacklens.fixture",
        "x-stacklens-csrf": session.csrfToken,
      };
      const submitted = await api.inject({
        method: "POST",
        url: "/v1/analyses/github",
        headers,
        payload: { repositoryUrl: capacityRepositoryUrl },
      });
      assert.equal(submitted.statusCode, 202);
      const id = submitted.json().analysisId;
      await until(async () => (await repository.findAnalysis(id))?.status.startsWith("completed"));
      const read = await api.inject({ method: "GET", url: `/v1/analyses/${id}`, headers });
      assert.equal(read.statusCode, 200);
      assert.equal(read.json().access, "connected");
      AnalysisReportSchema.parse(read.json().report);
      assert(githubReads >= 4);
      assert.equal(
        (await apiPool.query("SELECT count(*)::int AS count FROM analysis_report")).rows[0].count,
        0,
      );
      assert.equal(
        (await api.inject({ method: "GET", url: `/v1/analyses/${id}` })).statusCode,
        404,
      );
      const analysis = await repository.findAnalysis(id);
      assert.equal(analysis.ownerGithubId, "123");
      assert(analysis.retentionExpiresAt !== undefined);
      const delivery = (
        await pool.query("SELECT status FROM analysis_delivery WHERE analysis_id=$1", [id])
      ).rows[0];
      assert.equal(delivery.status, "delivered");
      assert.equal(
        (await api.inject({ method: "POST", url: "/v1/auth/sign-out", headers, payload: {} }))
          .statusCode,
        200,
      );
      assert.equal(
        (await api.inject({ method: "GET", url: `/v1/analyses/${id}`, headers })).statusCode,
        404,
      );
      await assert.rejects(
        connectedGitHubToken(store, key, "123", analysis.githubConnectionId),
        /GitHub connection is unavailable/u,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS count FROM stacklens_auth.github_connection"))
          .rows[0].count,
        0,
      );
    } catch (caught) {
      error = caught;
    }
    const cleanup = await cleanupSteps([
      ["stopWorker", () => worker?.stop()],
      ["stopApi", () => api?.close()],
      ["closeRestricted", () => apiPool?.end()],
      ["closeSource", () => pool?.end()],
      [
        "dropOwnedDatabase",
        () => (sourceCreated ? admin.query(`DROP DATABASE "${name}"`) : undefined),
      ],
      ["dropOwnedRole", () => (roleCreated ? admin.query(`DROP ROLE "${role}"`) : undefined)],
      ["closeAdmin", () => admin.end()],
    ]);
    assert.equal(cleanup.length, 0);
    // Test providers/owned credentials are synthetic; keep any connection failure diagnostic generic.
    if (error)
      throw new Error("private_pipeline_failed", {
        cause: error instanceof assert.AssertionError ? error : new Error("local_fixture_failed"),
      });
  },
);
