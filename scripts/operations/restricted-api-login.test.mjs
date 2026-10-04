/* oxlint-disable no-await-in-loop -- Privilege denials are separate ordered statements on one constrained pool. */
// FR-003/004/017/021/022, NFR-008/009, SEC-003/007: real privileges and durable Worker-only delivery.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createStackLensApiRuntime } from "../../apps/api/dist/index.js";
import {
  startStackLensWorker,
  createRepositoryAnalysisTaskList,
} from "../../apps/worker/dist/index.js";
import { recoveryProviders } from "../../apps/worker/test/recovery-fixtures.ts";
import {
  createStackLensPool,
  createStackLensDatabase,
  DrizzleAnalysisRepository,
} from "../../packages/persistence/dist/index.js";
import { requireLocalDatabase, until } from "./common.mjs";
import { grantRestrictedApiAccess, inspectRestrictedApiAccess } from "./restricted-api-login.mjs";

void test(
  "NFR-008/009, SEC-007: restricted API accepts durable work without migration or Graphile privileges",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const original = requireLocalDatabase(process.env.TEST_DATABASE_URL);
    const suffix = randomUUID().replaceAll("-", ""),
      database = `stacklens_access_${suffix}`,
      role = `stacklens_api_${suffix}`;
    const admin = createStackLensPool(original.toString(), undefined, { max: 1 });
    const ownerUrl = new URL(original);
    ownerUrl.pathname = `/${database}`;
    const limitedUrl = new URL(ownerUrl);
    limitedUrl.username = role;
    limitedUrl.password = "local-disposable-fixture";
    let owner,
      limited,
      api,
      bootstrap,
      worker,
      saturationPool,
      createdDatabase = false,
      createdRole = false;
    try {
      await admin.query(`CREATE DATABASE "${database}"`);
      createdDatabase = true;
      await admin.query(
        `CREATE ROLE "${role}" LOGIN PASSWORD 'local-disposable-fixture' CONNECTION LIMIT 2`,
      );
      createdRole = true;
      owner = createStackLensPool(ownerUrl.toString(), undefined, { max: 1 });
      await assert.rejects(
        createStackLensApiRuntime({
          connectionString: limitedUrl.toString(),
          databaseMode: "worker-managed",
          logger: false,
        }),
      );
      bootstrap = await createStackLensApiRuntime({
        connectionString: ownerUrl.toString(),
        startDeliveryPump: false,
        logger: false,
      });
      await bootstrap.stop();
      bootstrap = undefined;
      await grantRestrictedApiAccess(owner, role);
      const privileges = await inspectRestrictedApiAccess(owner, role);
      assert.equal(privileges.superuser, false);
      assert.equal(privileges.graphile_access, false);
      assert.equal(privileges.forbidden_writes, false);
      assert.equal(privileges.create_public_objects, false);
      assert.equal(privileges.create_database_objects, false);
      assert.equal(privileges.role_membership, false);
      assert.equal(privileges.replication, false);
      assert.equal(privileges.bypass_rls, false);
      assert.equal(privileges.analysis_access, true);
      assert.equal(privileges.outbox_access, true);
      await owner.query(`REVOKE INSERT ON public.analysis FROM "${role}"`);
      assert.equal((await inspectRestrictedApiAccess(owner, role)).analysis_access, false);
      await owner.query(`GRANT INSERT ON public.analysis TO "${role}"`);
      await owner.query(`GRANT UPDATE ON public.analysis_report TO "${role}"`);
      assert.equal((await inspectRestrictedApiAccess(owner, role)).forbidden_writes, true);
      await owner.query(`REVOKE UPDATE ON public.analysis_report FROM "${role}"`);
      await assert.rejects(
        createStackLensApiRuntime({ connectionString: limitedUrl.toString(), logger: false }),
      );
      limited = createStackLensPool(limitedUrl.toString(), undefined, { max: 1 });
      for (const sql of [
        "CREATE TABLE public.denied (id text)",
        "SELECT * FROM graphile_worker._private_jobs",
        "UPDATE analysis SET status = status",
        "DELETE FROM analysis",
        "TRUNCATE analysis_report",
        "CREATE SCHEMA denied",
      ])
        await assert.rejects(limited.query(sql), (error) => error.code === "42501");
      api = await createStackLensApiRuntime({
        connectionString: limitedUrl.toString(),
        databaseMode: "worker-managed",
        databasePoolOptions: { max: 1, maxUses: 1, connectionTimeoutMillis: 1_000 },
        logger: false,
      });
      const submitted = await api.app.inject({
        method: "POST",
        url: "/v1/analyses/repository",
        payload: { repositoryUrl: "https://github.com/acme/demo" },
      });
      assert.equal(submitted.statusCode, 202);
      const { analysisId } = submitted.json();
      assert.equal(
        (
          await owner.query("SELECT status FROM analysis_delivery WHERE analysis_id=$1", [
            analysisId,
          ])
        ).rows[0].status,
        "pending",
      );
      assert.equal(
        (await owner.query("SELECT count(*)::int AS count FROM graphile_worker._private_jobs"))
          .rows[0].count,
        0,
      );
      assert.equal(
        (await api.app.inject({ method: "GET", url: `/v1/analyses/${analysisId}` })).json().status,
        "queued",
      );
      const repository = new DrizzleAnalysisRepository(createStackLensDatabase(owner));
      worker = await startStackLensWorker({
        connectionString: ownerUrl.toString(),
        databasePoolOptions: { max: 5 },
        concurrency: 1,
        retentionCleanup: false,
        taskList: createRepositoryAnalysisTaskList({
          repository,
          analysisDependencies: recoveryProviders(),
        }),
      });
      await until(async () =>
        (await repository.findAnalysis(analysisId))?.status.startsWith("completed"),
      );
      const report = (
        await api.app.inject({ method: "GET", url: `/v1/analyses/${analysisId}` })
      ).json();
      assert.equal(report.report.schemaVersion, "2.0.0");
      const quick = await api.app.inject({
        method: "POST",
        url: "/v1/analyze/manifest",
        payload: { kind: "paste", content: '{"name":"restricted-fixture"}' },
      });
      assert.equal(quick.statusCode, 200);
      saturationPool = createStackLensPool(limitedUrl.toString(), undefined, { max: 1 });
      const first = await limited.connect();
      let second;
      try {
        second = await saturationPool.connect();
        const overloaded = await api.app.inject({
          method: "GET",
          url: `/v1/analyses/${analysisId}`,
        });
        assert.equal(overloaded.statusCode, 503);
        assert.equal(overloaded.json().code, "analysis_unavailable");
        assert(!overloaded.body.includes(role));
        assert(!overloaded.body.includes("local-disposable-fixture"));
        assert.equal((await owner.query("SELECT 1 AS worker_headroom")).rows[0].worker_headroom, 1);
      } finally {
        second?.release(true);
        first.release(true);
      }
      assert.equal(
        (await api.app.inject({ method: "GET", url: `/v1/analyses/${analysisId}` })).statusCode,
        200,
      );
    } finally {
      await worker?.stop();
      await api?.stop();
      await bootstrap?.stop();
      await limited?.end();
      await saturationPool?.end();
      await owner?.end();
      if (createdDatabase) await admin.query(`DROP DATABASE "${database}"`);
      if (createdRole) await admin.query(`DROP ROLE "${role}"`);
      await admin.end();
    }
  },
);
