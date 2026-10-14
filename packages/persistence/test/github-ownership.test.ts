import { randomBytes, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createStackLensDatabase,
  DrizzleAnalysisRepository,
  DrizzleGitHubConnectionStore,
  migrateStackLensDatabase,
  verifyConnectedApiDatabase,
} from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const schema = `stacklens_auth_test_${randomUUID().replaceAll("-", "")}`;
const role = `stacklens_auth_reader_${randomUUID().replaceAll("-", "")}`;
const legacy = `${schema}_old`;
const now = "2026-10-12T00:00:00.000Z";
const operationCases = (["find", "save", "remove", "purge"] as const).flatMap((operation) =>
  (["deadline", "cancel"] as const).map((mode) => ({ operation, mode })),
);
function runConnectionOperation(
  store: DrizzleGitHubConnectionStore,
  operation: (typeof operationCases)[number]["operation"],
  signal: AbortSignal,
) {
  const hash = "ab".repeat(32);
  const operations = {
    find: () => store.find(hash, signal),
    save: () =>
      store.save(
        {
          sessionHash: hash,
          githubId: "123",
          login: "synthetic",
          sealedToken: "synthetic-ciphertext",
          expiresAt: now,
        },
        signal,
      ),
    remove: () => store.remove(hash, signal),
    purge: () => store.purgeExpired(now, signal),
  };
  return operations[operation]();
}
(databaseUrl ? describe : describe.skip)(
  "connected PostgreSQL ownership [FR-100, SEC-003, SEC-005, SEC-007]",
  () => {
    const password = randomBytes(24).toString("hex");
    const restrictedUrl = new URL(databaseUrl || "postgresql://unused:unused@localhost/unused");
    restrictedUrl.username = role;
    restrictedUrl.password = password;
    const admin = new Pool({ connectionString: databaseUrl });
    const owner = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
    const restricted = new Pool({
      connectionString: restrictedUrl.toString(),
      max: 1,
      options: `-c search_path=${schema}`,
    });
    const database = createStackLensDatabase(owner);
    const repository = new DrizzleAnalysisRepository(createStackLensDatabase(restricted));
    beforeAll(async () => {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrateStackLensDatabase(database);
      const creation = await admin.query<{ command: string }>(
        "SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', $1::text, $2::text) AS command",
        [role, password],
      );
      await admin.query(creation.rows[0]?.command ?? "");
      await admin.query(`GRANT USAGE ON SCHEMA ${schema}, stacklens_auth TO ${role}`);
      await owner.query(`GRANT SELECT ON analysis, analysis_report, analysis_delivery TO ${role}`);
      await owner.query(`GRANT INSERT ON analysis, analysis_delivery TO ${role}`);
      await admin.query(
        `GRANT SELECT, INSERT, DELETE ON stacklens_auth.github_connection TO ${role}`,
      );
      await new DrizzleAnalysisRepository(database).createQueuedRepositoryAnalysisWithDelivery({
        id: "private",
        repositoryUrl: "https://github.com/acme/private",
        createdAt: now,
        ownerGithubId: "123",
        githubConnectionId: "ab".repeat(32),
      });
      await new DrizzleAnalysisRepository(database).createQueuedRepositoryAnalysisWithDelivery({
        id: "public",
        repositoryUrl: "https://github.com/acme/public",
        createdAt: now,
      });
      // Direct SQL fixtures prove even readers that bypass application checks cannot see private JSON.
      await owner.query("INSERT INTO analysis_report VALUES ('private','1.0.0','{}'::jsonb,$1)", [
        now,
      ]);
    });
    afterAll(async () => {
      await restricted.end();
      await owner.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${legacy} CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.query(`DROP OWNED BY ${role}`);
      await admin.query(`DROP ROLE ${role}`);
      await admin.end();
    });
    it("requires a restricted RLS login and denies anonymous/foreign reads in all three tables", async () => {
      await expect(verifyConnectedApiDatabase(database)).rejects.toThrow("restricted");
      await verifyConnectedApiDatabase(createStackLensDatabase(restricted));
      const switchedOwner = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${schema} -c role=${role}`,
      });
      try {
        await expect(
          verifyConnectedApiDatabase(createStackLensDatabase(switchedOwner)),
        ).rejects.toThrow("restricted");
      } finally {
        await switchedOwner.end();
      }
      expect(await repository.findAnalysis("private")).toBeUndefined();
      expect((await repository.findAnalysis("public"))?.id).toBe("public");
      expect(
        await repository.withOwner("456", (repo) => repo.findAnalysis("private")),
      ).toBeUndefined();
      const own = await repository.withOwner("123", (repo) => repo.findAnalysis("private"));
      expect(own?.ownerGithubId).toBe("123");
      const counts = await restricted.query(
        "SELECT (SELECT count(*) FROM analysis_report) reports, (SELECT count(*) FROM analysis_delivery) deliveries",
      );
      expect(counts.rows[0]).toEqual({ reports: "0", deliveries: "1" });
      // max=1 reuses the very same connection; identity must not leak after commit.
      expect(await repository.findAnalysis("private")).toBeUndefined();
    });
    it("enforces owner writes and rolls back both analysis and outbox on a forbidden insert", async () => {
      const input = {
        id: "forbidden",
        repositoryUrl: "https://github.com/acme/private",
        createdAt: now,
        ownerGithubId: "123",
        githubConnectionId: "ab".repeat(32),
      };
      await expect(
        repository.withOwner("456", (repo) =>
          repo.createQueuedRepositoryAnalysisWithDelivery(input),
        ),
      ).rejects.toThrow("Failed query");
      expect((await owner.query("SELECT id FROM analysis WHERE id='forbidden'")).rows).toEqual([]);
      expect(
        (
          await owner.query(
            "SELECT analysis_id FROM analysis_delivery WHERE analysis_id='forbidden'",
          )
        ).rows,
      ).toEqual([]);
      const created = await repository.withOwner("123", (repo) =>
        repo.createQueuedRepositoryAnalysisWithDelivery({ ...input, id: "allowed" }),
      );
      expect(created.ownerGithubId).toBe("123");
      expect(await repository.findAnalysis("allowed")).toBeUndefined();
    });
    it.each([
      "ALTER POLICY analysis_owner_read ON analysis USING (true)",
      "ALTER POLICY report_owner_read ON analysis_report USING (true)",
      "ALTER POLICY analysis_owner_create ON analysis WITH CHECK (true)",
      `ALTER POLICY analysis_owner_read ON analysis TO ${role}`,
      "DROP POLICY analysis_owner_create ON analysis",
      "DROP POLICY report_owner_read ON analysis_report; CREATE POLICY report_owner_read ON analysis_report FOR ALL USING (true)",
    ])("rejects drift and restores only owned policy definitions [SEC-005]: %s", async (drift) => {
      try {
        await owner.query(drift);
        await expect(
          verifyConnectedApiDatabase(createStackLensDatabase(restricted)),
        ).rejects.toThrow("restricted");
        await migrateStackLensDatabase(database);
        await verifyConnectedApiDatabase(createStackLensDatabase(restricted));
        expect(await repository.findAnalysis("private")).toBeUndefined();
        expect(
          (await restricted.query("SELECT count(*)::int reports FROM analysis_report")).rows[0],
        ).toEqual({ reports: 0 });
        expect(
          (await repository.withOwner("123", (repo) => repo.findAnalysis("private")))?.id,
        ).toBe("private");
      } finally {
        await migrateStackLensDatabase(database);
      }
    });
    it("rejects additional permissive policies without silently deleting operator policy [SEC-005]", async () => {
      await owner.query("CREATE POLICY unexpected_reader ON analysis FOR SELECT USING (true)");
      try {
        await expect(
          verifyConnectedApiDatabase(createStackLensDatabase(restricted)),
        ).rejects.toThrow("restricted");
        await expect(migrateStackLensDatabase(database)).rejects.toMatchObject({
          cause: expect.objectContaining({
            message: "Unexpected analysis ownership policies require operator review.",
          }),
        });
        expect(
          (
            await owner.query(
              "SELECT polname FROM pg_policy WHERE polrelid='analysis'::regclass AND polname='unexpected_reader'",
            )
          ).rows,
        ).toHaveLength(1);
      } finally {
        await owner.query("DROP POLICY unexpected_reader ON analysis");
        await migrateStackLensDatabase(database);
      }
    });
    it.each(operationCases)(
      "bounds blocked credential $operation and releases its client ($mode) [FR-100, NFR-008]",
      async ({ operation, mode }) => {
        const locker = await owner.connect();
        const controller = new AbortController();
        const store = new DrizzleGitHubConnectionStore(
          createStackLensDatabase(restricted),
          mode === "deadline" ? 200 : 5000,
        );
        await locker.query("BEGIN");
        await locker.query("LOCK TABLE stacklens_auth.github_connection IN ACCESS EXCLUSIVE MODE");
        try {
          const outcome = runConnectionOperation(store, operation, controller.signal).then(
            () => undefined,
            (error: unknown) => error,
          );
          if (mode === "cancel") {
            await vi.waitFor(async () => {
              const activity = await admin.query(
                "SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",
                [role],
              );
              if (activity.rows.length !== 1)
                throw new Error("Credential operation is not waiting for the owned lock yet.");
            });
            controller.abort();
          }
          const failure = await outcome;
          // Either the server timeout or the client deadline may win under scheduler contention.
          const timedOut =
            failure instanceof Error &&
            (failure.name === "TimeoutError" || ("code" in failure && failure.code === "57014"));
          expect(
            mode === "deadline"
              ? timedOut
              : failure instanceof Error && failure.name === "AbortError",
          ).toBe(true);
          await vi.waitFor(() => expect(restricted.totalCount).toBe(0));
        } finally {
          controller.abort();
          await locker.query("ROLLBACK");
          locker.release();
        }
        expect(
          await new DrizzleGitHubConnectionStore(createStackLensDatabase(restricted)).find(
            "ab".repeat(32),
          ),
        ).toBeUndefined();
      },
    );
    it.each(operationCases)(
      "bounds a waiting $operation checkout without destroying another caller's client ($mode) [FR-100, NFR-008]",
      async ({ operation, mode }) => {
        const held = await restricted.connect();
        const controller = new AbortController();
        try {
          const store = new DrizzleGitHubConnectionStore(
            createStackLensDatabase(restricted),
            mode === "deadline" ? 200 : 5000,
          );
          const outcome = runConnectionOperation(store, operation, controller.signal).then(
            () => undefined,
            (error: unknown) => error,
          );
          await vi.waitFor(() => expect(restricted.waitingCount).toBe(1));
          if (mode === "cancel") controller.abort();
          expect(await outcome).toMatchObject({
            name: mode === "cancel" ? "AbortError" : "TimeoutError",
          });
          expect((await held.query("SELECT 1 AS alive")).rows[0]).toEqual({ alive: 1 });
        } finally {
          controller.abort();
          held.release();
        }
        await vi.waitFor(() => expect(restricted.waitingCount).toBe(0));
        await vi.waitFor(() => expect(restricted.totalCount).toBe(0));
        expect((await restricted.query("SHOW statement_timeout")).rows[0]).toEqual({
          statement_timeout: "0",
        });
      },
    );
    it("reads a pre-FR-100 archived schema without altering historical rows", async () => {
      await admin.query(`CREATE SCHEMA ${legacy}`);
      await owner.query(`CREATE TABLE ${legacy}.analysis (LIKE analysis)`);
      await admin.query(
        `ALTER TABLE ${legacy}.analysis DROP COLUMN owner_github_id, DROP COLUMN github_connection_id`,
      );
      await admin.query(
        `INSERT INTO ${legacy}.analysis (id,input_type,repository_url,status,progress_stage,created_at,updated_at) VALUES ('legacy','repository','https://github.com/acme/public','queued','queued',$1,$1)`,
        [now],
      );
      const oldPool = new Pool({
        connectionString: databaseUrl,
        options: `-c search_path=${legacy}`,
      });
      try {
        expect(
          (
            await new DrizzleAnalysisRepository(createStackLensDatabase(oldPool)).findAnalysis(
              "legacy",
            )
          )?.ownerGithubId,
        ).toBeUndefined();
      } finally {
        await oldPool.end();
      }
    });
    it("stores only sealed connection data and purges bounded expired connections", async () => {
      const store = new DrizzleGitHubConnectionStore(createStackLensDatabase(restricted));
      const hash = randomUUID().replaceAll("-", "").repeat(2);
      try {
        await store.save({
          sessionHash: hash,
          githubId: "123",
          login: "alice",
          sealedToken: "synthetic-ciphertext",
          expiresAt: "2020-01-01T00:00:00.000Z",
        });
        expect((await store.find(hash))?.expiresAt).toBe("2020-01-01T00:00:00.000Z");
        expect(
          await new DrizzleGitHubConnectionStore(database).purgeExpired(now),
        ).toBeGreaterThanOrEqual(1);
        expect(await store.find(hash)).toBeUndefined();
      } finally {
        await store.remove(hash);
      }
    });
  },
);
