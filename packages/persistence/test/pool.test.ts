import { Client, type Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStackLensPool } from "../src/pool.js";

const pools: Pool[] = [];

afterEach(async () => {
  await Promise.all(pools.splice(0).map(async (pool) => pool.end()));
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
