import { randomBytes, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createStackLensDatabase,
  DrizzleAnalysisRepository,
  migrateStackLensDatabase,
  verifyConnectedApiDatabase,
  verifyStackLensDatabase,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const suffix = randomUUID().replaceAll("-", "");
const databaseName = `stacklens_activation_test_${suffix}`;
const role = `stacklens_activation_reader_${suffix}`;

(databaseUrl ? describe : describe.skip)(
  "connected API object privileges [FR-100, SEC-003, SEC-005, SEC-007]",
  () => {
    // A fresh owned database lets these tests change credential ownership and PUBLIC grants
    // without touching the shared development database or other concurrent fixtures.
    const admin = new Pool({ connectionString: databaseUrl, max: 1 });
    let worker: Pool;
    let api: Pool;
    let owner: string;
    let publicOwner: string;
    let databaseCreated = false;
    let roleCreated = false;
    beforeAll(async () => {
      await admin.query(`CREATE DATABASE ${databaseName}`);
      databaseCreated = true;
      const password = randomBytes(24).toString("hex");
      const creation = await admin.query<{ command: string }>(
        "SELECT pg_catalog.format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD %L', $1::text, $2::text) AS command",
        [role, password],
      );
      await admin.query(creation.rows[0]?.command ?? "");
      roleCreated = true;
      const workerUrl = new URL(databaseUrl);
      workerUrl.pathname = `/${databaseName}`;
      worker = new Pool({ connectionString: workerUrl.toString(), max: 1 });
      const apiUrl = new URL(workerUrl);
      apiUrl.username = role;
      apiUrl.password = password;
      api = new Pool({ connectionString: apiUrl.toString(), max: 1 });
      await migrateStackLensDatabase(createStackLensDatabase(worker));
      const ownership = await worker.query<{ owner: string; public_owner: string }>(
        "SELECT pg_catalog.quote_ident(current_user) AS owner, pg_catalog.quote_ident(r.rolname) AS public_owner FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public'",
      );
      owner = ownership.rows[0]?.owner ?? "";
      publicOwner = ownership.rows[0]?.public_owner ?? "";
      await worker.query(`CREATE SCHEMA outside_api_path`);
      await worker.query(`GRANT USAGE ON SCHEMA public, stacklens_auth TO ${role}`);
      await worker.query(`GRANT SELECT ON analysis, analysis_report, analysis_delivery TO ${role}`);
      await worker.query(`GRANT INSERT ON analysis, analysis_delivery TO ${role}`);
      await worker.query(
        `GRANT SELECT, INSERT, DELETE ON stacklens_auth.github_connection TO ${role}`,
      );
      const repository = new DrizzleAnalysisRepository(createStackLensDatabase(worker));
      await Promise.all(
        ["public", "private"].map((id) =>
          repository.createQueuedRepositoryAnalysisWithDelivery({
            id,
            repositoryUrl: `https://github.com/acme/${id}`,
            createdAt: "2026-10-13T00:00:00.000Z",
            ...(id === "private"
              ? { ownerGithubId: "123", githubConnectionId: "ab".repeat(32) }
              : {}),
          }),
        ),
      );
    });
    afterAll(async () => {
      await api?.end();
      await worker?.end();
      try {
        if (databaseCreated) await admin.query(`DROP DATABASE ${databaseName}`);
        if (roleCreated) await admin.query(`DROP ROLE ${role}`);
      } finally {
        await admin.end();
      }
    });
    it("accepts the approved restricted login without schema or database CREATE", async () => {
      await verifyConnectedApiDatabase(createStackLensDatabase(api));
      expect(
        await new DrizzleAnalysisRepository(createStackLensDatabase(api)).findAnalysis("private"),
      ).toBeUndefined();
    });
    const forbiddenTablePrivileges = [
      {
        table: "analysis",
        privileges: ["UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES", "MAINTAIN"],
      },
      {
        table: "analysis_report",
        privileges: ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES", "MAINTAIN"],
      },
      {
        table: "analysis_delivery",
        privileges: ["UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES", "MAINTAIN"],
      },
      {
        table: "stacklens_auth.github_connection",
        privileges: ["UPDATE", "TRUNCATE", "TRIGGER", "REFERENCES", "MAINTAIN"],
      },
    ].flatMap(({ table, privileges }) => privileges.map((privilege) => ({ table, privilege })));
    it.each(forbiddenTablePrivileges)(
      "rejects extra table grant $privilege on $table [FR-100, SEC-005]",
      async ({ table, privilege }) => {
        await worker.query(`GRANT ${privilege} ON ${table} TO ${role}`);
        try {
          await expect(verifyConnectedApiDatabase(createStackLensDatabase(api))).rejects.toThrow(
            "restricted",
          );
        } finally {
          await worker.query(`REVOKE ${privilege} ON ${table} FROM ${role}`);
        }
        await verifyConnectedApiDatabase(createStackLensDatabase(api));
      },
    );
    const forbiddenColumnPrivileges = [
      { table: "analysis", column: "owner_github_id", privileges: ["UPDATE", "REFERENCES"] },
      {
        table: "analysis_report",
        column: "report",
        privileges: ["INSERT", "UPDATE", "REFERENCES"],
      },
      { table: "analysis_delivery", column: "analysis_id", privileges: ["UPDATE", "REFERENCES"] },
      {
        table: "stacklens_auth.github_connection",
        column: "expires_at",
        privileges: ["UPDATE", "REFERENCES"],
      },
    ].flatMap(({ table, column, privileges }) =>
      privileges.map((privilege) => ({ table, column, privilege })),
    );
    it.each(forbiddenColumnPrivileges)(
      "rejects extra column grant $privilege on $table.$column [FR-100, SEC-005]",
      async ({ table, column, privilege }) => {
        await worker.query(`GRANT ${privilege} (${column}) ON ${table} TO ${role}`);
        try {
          await expect(verifyConnectedApiDatabase(createStackLensDatabase(api))).rejects.toThrow(
            "restricted",
          );
        } finally {
          await worker.query(`REVOKE ${privilege} (${column}) ON ${table} FROM ${role}`);
        }
        await verifyConnectedApiDatabase(createStackLensDatabase(api));
      },
    );
    it("rejects destructive PUBLIC grants and preserves private rows [FR-100, SEC-005]", async () => {
      await worker.query(
        "GRANT TRUNCATE ON analysis, analysis_report, analysis_delivery TO PUBLIC",
      );
      try {
        await expect(verifyConnectedApiDatabase(createStackLensDatabase(api))).rejects.toThrow(
          "restricted",
        );
      } finally {
        await worker.query(
          "REVOKE TRUNCATE ON analysis, analysis_report, analysis_delivery FROM PUBLIC",
        );
      }
      await verifyConnectedApiDatabase(createStackLensDatabase(api));
      await expect(
        api.query("TRUNCATE analysis, analysis_report, analysis_delivery"),
      ).rejects.toMatchObject({ code: "42501" });
      expect(
        (
          await new DrizzleAnalysisRepository(createStackLensDatabase(worker)).findAnalysis(
            "private",
          )
        )?.ownerGithubId,
      ).toBe("123");
      expect(
        await new DrizzleAnalysisRepository(createStackLensDatabase(api)).findAnalysis("private"),
      ).toBeUndefined();
    });
    const requiredTablePrivileges = [
      { table: "analysis", privileges: ["SELECT", "INSERT"] },
      { table: "analysis_report", privileges: ["SELECT"] },
      { table: "analysis_delivery", privileges: ["SELECT", "INSERT"] },
      { table: "stacklens_auth.github_connection", privileges: ["SELECT", "INSERT", "DELETE"] },
    ].flatMap(({ table, privileges }) => privileges.map((privilege) => ({ table, privilege })));
    it.each(requiredTablePrivileges)(
      "rejects missing required $privilege on $table [FR-100, SEC-005]",
      async ({ table, privilege }) => {
        await worker.query(`REVOKE ${privilege} ON ${table} FROM ${role}`);
        try {
          await expect(verifyConnectedApiDatabase(createStackLensDatabase(api))).rejects.toThrow(
            /restricted|Failed query/u,
          );
        } finally {
          await worker.query(`GRANT ${privilege} ON ${table} TO ${role}`);
        }
        await verifyConnectedApiDatabase(createStackLensDatabase(api));
      },
    );
    it.each([
      "application schema grant",
      "PUBLIC schema grant",
      "credential schema grant",
      "schema outside search path",
      "database grant",
      "database owner with CREATE revoked",
      "application schema owner",
      "schema owner with CREATE revoked",
      "credential schema owner",
      "credential table owner",
    ] as const)("rejects effective DDL access from %s", async (access) => {
      const changes: Record<typeof access, readonly [string, string]> = {
        "application schema grant": [
          `GRANT CREATE ON SCHEMA public TO ${role}`,
          `REVOKE CREATE ON SCHEMA public FROM ${role}`,
        ],
        "PUBLIC schema grant": [
          "GRANT CREATE ON SCHEMA public TO PUBLIC",
          "REVOKE CREATE ON SCHEMA public FROM PUBLIC",
        ],
        "credential schema grant": [
          `GRANT CREATE ON SCHEMA stacklens_auth TO ${role}`,
          `REVOKE CREATE ON SCHEMA stacklens_auth FROM ${role}`,
        ],
        "schema outside search path": [
          `GRANT CREATE ON SCHEMA outside_api_path TO ${role}`,
          `REVOKE CREATE ON SCHEMA outside_api_path FROM ${role}`,
        ],
        "database grant": [
          `GRANT CREATE ON DATABASE ${databaseName} TO ${role}`,
          `REVOKE CREATE ON DATABASE ${databaseName} FROM ${role}`,
        ],
        "database owner with CREATE revoked": [
          `ALTER SCHEMA public OWNER TO ${owner}; ALTER DATABASE ${databaseName} OWNER TO ${role}; REVOKE CREATE ON DATABASE ${databaseName} FROM ${role}`,
          `ALTER DATABASE ${databaseName} OWNER TO ${owner}; ALTER SCHEMA public OWNER TO ${publicOwner}`,
        ],
        "application schema owner": [
          `ALTER SCHEMA public OWNER TO ${role}`,
          `ALTER SCHEMA public OWNER TO ${publicOwner}`,
        ],
        "schema owner with CREATE revoked": [
          `ALTER SCHEMA public OWNER TO ${role}; REVOKE CREATE ON SCHEMA public FROM ${role}`,
          `ALTER SCHEMA public OWNER TO ${publicOwner}`,
        ],
        "credential schema owner": [
          `ALTER SCHEMA stacklens_auth OWNER TO ${role}`,
          `ALTER SCHEMA stacklens_auth OWNER TO ${owner}`,
        ],
        "credential table owner": [
          `ALTER TABLE stacklens_auth.github_connection OWNER TO ${role}`,
          `ALTER TABLE stacklens_auth.github_connection OWNER TO ${owner}`,
        ],
      };
      const [apply, restore] = changes[access];
      await worker.query(apply);
      try {
        await expect(verifyConnectedApiDatabase(createStackLensDatabase(api))).rejects.toThrow(
          "restricted",
        );
      } finally {
        await worker.query(restore);
        // ALTER OWNER transfers ACL entries too; restore the fixture's approved grants.
        await worker.query(`GRANT USAGE ON SCHEMA public, stacklens_auth TO ${role}`);
        await worker.query(
          `GRANT SELECT, INSERT, DELETE ON stacklens_auth.github_connection TO ${role}`,
        );
      }
      await verifyConnectedApiDatabase(createStackLensDatabase(api));
    });
    it("never runs an API-created exact-type JSON overload with Worker read privileges", async () => {
      await worker.query(`GRANT CREATE ON SCHEMA public TO ${role}`);
      try {
        await api.query(`CREATE FUNCTION public.to_jsonb(public.analysis) RETURNS jsonb LANGUAGE plpgsql AS $$
          BEGIN
            IF pg_catalog.has_table_privilege(current_user, 'public.analysis', 'UPDATE') THEN
              UPDATE public.analysis SET owner_github_id=NULL, github_connection_id=NULL WHERE id='private';
            END IF;
            RETURN pg_catalog.to_jsonb($1);
          END $$`);
        await expect(verifyConnectedApiDatabase(createStackLensDatabase(api))).rejects.toThrow(
          "restricted",
        );
        const database = createStackLensDatabase(worker);
        await verifyStackLensDatabase(database);
        const repository = new DrizzleAnalysisRepository(database);
        expect((await repository.findAnalysis("public"))?.id).toBe("public");
        const privateRow = await repository.findAnalysis("private");
        expect(privateRow?.ownerGithubId).toBe("123");
        expect(privateRow?.githubConnectionId).toBe("ab".repeat(32));
        expect(
          await new DrizzleAnalysisRepository(createStackLensDatabase(api)).findAnalysis("private"),
        ).toBeUndefined();
      } finally {
        await worker.query("DROP FUNCTION IF EXISTS public.to_jsonb(public.analysis)");
        await worker.query(`REVOKE CREATE ON SCHEMA public FROM ${role}`);
      }
    });
  },
);
