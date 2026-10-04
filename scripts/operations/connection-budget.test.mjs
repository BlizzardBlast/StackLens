/* oxlint-disable no-await-in-loop -- Hold distinct pools sequentially to test the exact connection ceiling. */
// NFR-008/009: verify PostgreSQL's aggregate role ceiling across independent pools.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createStackLensPool } from "../../packages/persistence/dist/index.js";
import { requireLocalDatabase } from "./common.mjs";

void test(
  "a non-superuser connection budget bounds independent pools and recovers after release",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const url = requireLocalDatabase(process.env.TEST_DATABASE_URL);
    const admin = createStackLensPool(url.toString(), undefined, { max: 1 });
    const role = `stacklens_budget_${randomUUID().replaceAll("-", "")}`;
    const pools = [],
      clients = [];
    let created = false;
    try {
      await admin.query(
        `CREATE ROLE "${role}" LOGIN PASSWORD 'local-disposable-fixture' CONNECTION LIMIT 3`,
      );
      created = true;
      const roleUrl = new URL(url);
      roleUrl.username = role;
      roleUrl.password = "local-disposable-fixture";
      for (let index = 0; index < 4; index++)
        pools.push(
          createStackLensPool(roleUrl.toString(), undefined, {
            max: 1,
            connectionTimeoutMillis: 1_000,
          }),
        );
      for (const pool of pools.slice(0, 3)) clients.push(await pool.connect());
      await assert.rejects(pools[3].connect(), (error) => error.code === "53300");
      // The same server retains administrative headroom while application connections are exhausted.
      assert.equal((await admin.query("SELECT 1 AS available")).rows[0].available, 1);
      clients.pop().release(true);
      const restored = await pools[3].connect();
      assert.equal((await restored.query("SELECT 1 AS available")).rows[0].available, 1);
      restored.release(true);
    } finally {
      for (const client of clients) client.release(true);
      await Promise.all(pools.map((pool) => pool.end()));
      if (created) await admin.query(`DROP ROLE "${role}"`);
      await admin.end();
    }
  },
);
