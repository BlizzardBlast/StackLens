import type { attachDatabasePool } from "@vercel/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { createStackLensApiRuntime } from "../src/runtime.js";

const mocks = vi.hoisted(() => ({
  create: vi
    .fn<(...args: Parameters<typeof createStackLensApiRuntime>) => Promise<unknown>>()
    .mockResolvedValue({ app: {} }),
  attach: vi.fn<typeof attachDatabasePool>(),
}));
vi.mock("../src/runtime.js", () => ({ createStackLensApiRuntime: mocks.create }));
vi.mock("@vercel/functions", () => ({ attachDatabasePool: mocks.attach }));

import { createVercelApiRuntime } from "../src/vercel-runtime.js";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("Vercel API composition [FR-003, FR-022, SEC-003, SEC-007, NFR-009]", () => {
  it("attaches a small shared pool and leaves continuous delivery to the Worker", async () => {
    await createVercelApiRuntime({ DATABASE_URL: "postgresql://fixture@localhost/fixture" });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        databasePoolOptions: { max: 1 },
        startDeliveryPump: false,
        retentionHours: 24,
        logger: false,
        onDatabasePoolCreated: mocks.attach,
      }),
    );
  });

  it("preserves verified TLS and explicit runtime limits", async () => {
    await createVercelApiRuntime({
      DATABASE_URL: "postgresql://fixture@localhost/fixture",
      STACKLENS_DATABASE_SSL_CA: "fixture forwarded to pool validation",
      STACKLENS_DATABASE_POOL_MAX: "2",
      STACKLENS_RETENTION_HOURS: "12",
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        databasePoolOptions: { max: 2, sslCa: "fixture forwarded to pool validation" },
        retentionHours: 12,
      }),
    );
  });

  it.each(["", "0", "1.5", "8761", "invalid"])(
    "rejects invalid retention %s before startup",
    async (value) => {
      await expect(
        createVercelApiRuntime({
          DATABASE_URL: "postgresql://fixture@localhost/fixture",
          STACKLENS_RETENTION_HOURS: value,
        }),
      ).rejects.toThrow("STACKLENS_RETENTION_HOURS must be an integer from 1 to 8760.");
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );

  it("never falls back to a local database in an unconfigured deployment", async () => {
    await expect(createVercelApiRuntime({})).rejects.toThrow("Vercel API requires DATABASE_URL.");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
