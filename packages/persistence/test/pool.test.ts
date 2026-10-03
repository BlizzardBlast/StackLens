import { rootCertificates } from "node:tls";

import { Client, type Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readStackLensPoolOptions } from "../src/pool-options.js";
import { createStackLensPool } from "../src/pool.js";

const pools: Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()));
});

describe("Hosted PostgreSQL configuration [FR-003, FR-022, NFR-009, SEC-007]", () => {
  const ca = rootCertificates[0]!;
  const connectionString = "postgresql://fixture:secret@db.example.com/fixture";

  it("preserves local defaults when hosted options are absent", () => {
    expect(readStackLensPoolOptions({})).toEqual({});
    const pool = createStackLensPool(connectionString);
    pools.push(pool);
    expect(pool.options.max).toBe(10);
    expect(pool.options.connectionTimeoutMillis).toBe(10_000);
    expect(pool.options.maxUses).toBe(Infinity);
  });

  it("uses the same verified CA and pool cap for PostgreSQL clients", () => {
    const options = readStackLensPoolOptions({
      STACKLENS_DATABASE_POOL_MAX: "3",
      STACKLENS_DATABASE_SSL_CA: ca,
    });
    const pool = createStackLensPool(connectionString, undefined, options);
    pools.push(pool);
    const client = new Client(pool.options);
    expect(pool.options.max).toBe(3);
    expect(client.ssl).toEqual({ ca, rejectUnauthorized: true });
  });

  it.skipIf(process.env.TEST_DATABASE_URL === undefined)(
    "retires released clients without interrupting transactions or queued acquisitions",
    async () => {
      const pool = createStackLensPool(process.env.TEST_DATABASE_URL!, undefined, {
        max: 1,
        maxUses: 1,
      });
      pools.push(pool);
      const client = await pool.connect();
      let firstPid: number | undefined;
      try {
        await client.query("BEGIN");
        const first = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        firstPid = first.rows[0]!.pid;
        const second = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        expect(second.rows[0]!.pid).toBe(firstPid);
        await client.query("COMMIT");
      } finally {
        client.release();
      }

      const queued = await Promise.all(
        Array.from({ length: 4 }, async () =>
          pool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"),
        ),
      );
      const pids = queued.map((result) => result.rows[0]!.pid);
      expect(firstPid).toBeDefined();
      expect(new Set([firstPid, ...pids]).size).toBe(5);
      expect(pool.idleCount).toBe(0);
      expect(pool.totalCount).toBe(0);
      expect(pool.waitingCount).toBe(0);
    },
  );

  it.skipIf(process.env.TEST_DATABASE_URL === undefined)(
    "reports the hosted API label to PostgreSQL for connection attribution",
    async () => {
      const pool = createStackLensPool(process.env.TEST_DATABASE_URL!, undefined, {
        applicationName: "stacklens-api-vercel",
      });
      pools.push(pool);
      const result = await pool.query("SELECT current_setting('application_name') AS label");
      expect(result.rows).toEqual([{ label: "stacklens-api-vercel" }]);
    },
  );

  it.each([
    "sslmode=require",
    "sslmode=no-verify",
    "ssl=0",
    "sslrootcert=secret",
    "sslcert=secret",
    "sslkey=secret",
    "sslnegotiation=direct",
  ])("rejects URL SSL overrides without exposing credentials: %s", (parameter) => {
    expect(() =>
      createStackLensPool(`${connectionString}?${parameter}`, undefined, { sslCa: ca }),
    ).toThrow("Remove URL SSL parameters when configuring the database CA certificate.");
  });

  it.each(["", "0", "-1", "1.5", "Infinity", "secret", " 3", "1e2"])(
    "rejects invalid environment pool limits: %s",
    (value) => {
      expect(() => readStackLensPoolOptions({ STACKLENS_DATABASE_POOL_MAX: value })).toThrow(
        "STACKLENS_DATABASE_POOL_MAX must be a positive integer.",
      );
    },
  );

  it.each([0, -1, 1.5, Infinity, NaN])("rejects invalid injected use limit: %s", (maxUses) => {
    expect(() => createStackLensPool(connectionString, undefined, { maxUses })).toThrow(
      "Database connection use limit must be a positive integer.",
    );
  });

  it("fails closed on empty or malformed CA values and invalid URLs", () => {
    expect(() => readStackLensPoolOptions({ STACKLENS_DATABASE_SSL_CA: " " })).toThrow(
      "STACKLENS_DATABASE_SSL_CA must contain a PEM certificate.",
    );
    for (const sslCa of [
      "secret",
      "-----BEGIN CERTIFICATE-----\nsecret\n-----END CERTIFICATE-----",
    ]) {
      expect(() => createStackLensPool(connectionString, undefined, { sslCa })).toThrow(
        "Database CA must contain a PEM certificate.",
      );
    }
    expect(() => createStackLensPool("secret", undefined, { sslCa: ca })).toThrow(
      "Certificate-verified database connections require a PostgreSQL URL.",
    );
    expect(() => createStackLensPool(connectionString, undefined, { max: 0 })).toThrow(
      "Database pool maximum must be a positive integer.",
    );
    expect(() =>
      createStackLensPool(connectionString, undefined, { connectionTimeoutMillis: 0 }),
    ).toThrow("Database connection timeout must be a positive integer.");
  });
});

describe("PostgreSQL error handling [NFR-009, SEC-007]", () => {
  it("reports pool and first-connection errors before any consumer initializes", () => {
    const onError = vi.fn<(error: Error) => void>();
    const pool = createStackLensPool("postgresql://unused/fixture", onError);
    pools.push(pool);
    const client = new Client();
    const poolError = new Error("Synthetic idle connection failure");
    const clientError = new Error("Synthetic checked-out connection failure");

    // Emit lifecycle events without a PostgreSQL server or Graphile's fallback handlers.
    expect(() => pool.emit("error", poolError)).not.toThrow();
    pool.emit("connect", client);
    expect(() => client.emit("error", clientError)).not.toThrow();

    expect(onError.mock.calls).toEqual([[poolError], [clientError]]);
  });

  it("covers every new client without adding listeners when a client is reused", () => {
    const onError = vi.fn<(error: Error) => void>();
    const pool = createStackLensPool("postgresql://unused/fixture", onError);
    pools.push(pool);
    const first = new Client();
    const second = new Client();
    pool.emit("connect", first);
    pool.emit("connect", second);

    for (let reuse = 0; reuse < 3; reuse += 1) {
      pool.emit("acquire", first);
      pool.emit("release", undefined, first);
    }

    const error = new Error("Synthetic connection failure");
    first.emit("error", error);
    second.emit("error", error);
    expect(onError.mock.calls).toEqual([[error], [error]]);
  });

  it("retains error handlers through pool shutdown", async () => {
    const onError = vi.fn<(error: Error) => void>();
    const pool = createStackLensPool("postgresql://unused/fixture", onError);
    const client = new Client();
    pool.emit("connect", client);

    const ending = pool.end();
    const error = new Error("Synthetic shutdown connection failure");
    expect(() => pool.emit("error", error)).not.toThrow();
    expect(() => client.emit("error", error)).not.toThrow();
    await ending;

    expect(onError.mock.calls).toEqual([[error], [error]]);
  });

  it("handles errors when the optional reporter is omitted", () => {
    const pool = createStackLensPool("postgresql://unused/fixture");
    pools.push(pool);
    const client = new Client();
    pool.emit("connect", client);
    const error = new Error("Synthetic failure with potentially sensitive details");

    expect(() => pool.emit("error", error)).not.toThrow();
    expect(() => client.emit("error", error)).not.toThrow();
  });
});
