/* oxlint-disable no-await-in-loop -- Owned databases are prepared, fingerprinted and removed in order. */
// NFR-009, SEC-003/007: backup verification must not depend on provider collation/timezone defaults.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { fingerprint } from "./backup.mjs";
import { requireLocalDatabase, sha256 } from "./common.mjs";

async function legacy(pool) {
  return sha256(
    JSON.stringify(
      (
        await pool.query(
          "SELECT to_jsonb(t) AS row FROM graphile_worker.migrations t ORDER BY to_jsonb(t)::text",
        )
      ).rows.map((item) => item.row),
    ),
  );
}

void test(
  "NFR-009, SEC-003/007: identical stored rows have identical backup hashes across C and ICU locales",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const original = requireLocalDatabase(process.env.TEST_DATABASE_URL);
    const suffix = randomUUID().replaceAll("-", "");
    const names = [`stacklens_hash_c_${suffix}`, `stacklens_hash_icu_${suffix}`];
    const admin = createStackLensPool(original.toString(), undefined, { max: 1 });
    const pools = [],
      created = [];
    try {
      await admin.query(
        `CREATE DATABASE "${names[0]}" TEMPLATE template0 LOCALE_PROVIDER libc LOCALE 'C'`,
      );
      created.push(names[0]);
      await admin.query(
        `CREATE DATABASE "${names[1]}" TEMPLATE template0 LOCALE_PROVIDER icu ICU_LOCALE 'en-US-u-kn-true'`,
      );
      created.push(names[1]);
      for (const name of names) {
        const url = new URL(original);
        url.pathname = `/${name}`;
        const pool = createStackLensPool(url.toString(), undefined, { max: 1 });
        pools.push(pool);
        await pool.query("CREATE SCHEMA graphile_worker");
        for (const table of [
          "public.analysis",
          "public.analysis_report",
          "public.analysis_delivery",
          "graphile_worker._private_jobs",
          "graphile_worker._private_job_queues",
          "graphile_worker._private_tasks",
          "graphile_worker.migrations",
        ]) {
          await pool.query(`CREATE TABLE ${table} (id integer, ts timestamptz)`);
          await pool.query(
            `INSERT INTO ${table} VALUES (1,'2026-01-01T00:00:00Z'),(10,'2026-01-01T00:00:00Z'),(2,'2026-01-01T00:00:00Z')`,
          );
        }
      }
      assert.notEqual(await legacy(pools[0]), await legacy(pools[1]));
      await pools[0].query("SET TIME ZONE 'UTC'");
      await pools[1].query("SET TIME ZONE 'Asia/Jakarta'");
      assert.deepEqual(await fingerprint(pools[0]), await fingerprint(pools[1]));
    } finally {
      const ended = await Promise.allSettled(pools.map((pool) => pool.end()));
      const dropped = await Promise.allSettled(
        created.map((name) => admin.query(`DROP DATABASE "${name}"`)),
      );
      await admin.end();
      assert.equal(
        ended.every((x) => x.status === "fulfilled"),
        true,
      );
      assert.equal(
        dropped.every((x) => x.status === "fulfilled"),
        true,
      );
    }
  },
);
