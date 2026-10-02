import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { createStackLensApiRuntime } from "../src/runtime.js";

const mocks = vi.hoisted(() => ({
  start: vi.fn<(...args: Parameters<typeof createStackLensApiRuntime>) => Promise<unknown>>(),
  stop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  listen: vi.fn<() => Promise<string>>().mockResolvedValue("http://127.0.0.1:3000"),
}));
vi.mock("../src/runtime.js", () => ({
  createStackLensApiRuntime: mocks.start,
}));

const signals = ["SIGINT", "SIGTERM"] as const;
const registration = vi.spyOn(process, "once");
afterAll(() => registration.mockRestore());
let previousListeners: Map<(typeof signals)[number], ReturnType<typeof process.rawListeners>>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  previousListeners = new Map(signals.map((signal) => [signal, process.rawListeners(signal)]));
  vi.stubEnv("DATABASE_URL", undefined);
  vi.stubEnv("STACKLENS_API_HOST", undefined);
  vi.stubEnv("STACKLENS_API_PORT", undefined);
  vi.stubEnv("STACKLENS_DATABASE_POOL_MAX", undefined);
  vi.stubEnv("STACKLENS_DATABASE_SSL_CA", undefined);
  mocks.start.mockResolvedValue({ app: { listen: mocks.listen }, stop: mocks.stop });
});

afterEach(() => {
  for (const [signal, listener] of registration.mock.calls) {
    if (signal === "SIGINT" || signal === "SIGTERM") {
      process.removeListener(signal, listener);
    }
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

// FR-003, FR-022, NFR-009: default local startup and explicit overrides.
describe("API executable configuration", () => {
  it("forwards hosted database settings [FR-003, FR-022, SEC-007]", async () => {
    vi.stubEnv("STACKLENS_DATABASE_POOL_MAX", "3");
    vi.stubEnv("STACKLENS_DATABASE_SSL_CA", "fixture CA forwarded to pool validation");
    await import("../src/main.js");
    await vi.waitFor(
      () => {
        expect(mocks.start).toHaveBeenCalledWith(
          expect.objectContaining({
            databasePoolOptions: { max: 3, sslCa: "fixture CA forwarded to pool validation" },
          }),
        );
        // Wait for startup's async continuation before resetModules/environment cleanup.
        expect(mocks.listen).toHaveBeenCalledOnce();
        expect(process.rawListeners("SIGTERM")).toHaveLength(
          (previousListeners.get("SIGTERM")?.length ?? 0) + 1,
        );
      },
      { timeout: 5_000 },
    );
  });
  it.each([
    [undefined, "postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens"],
    [
      "postgresql://test:secret@localhost:6543/isolated",
      "postgresql://test:secret@localhost:6543/isolated",
    ],
  ])("uses the expected database with DATABASE_URL=%s", async (configured, expected) => {
    vi.stubEnv("DATABASE_URL", configured);
    await import("../src/main.js");
    await vi.waitFor(() => {
      expect(mocks.start).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ connectionString: expected, logger: true }),
      );
      expect(process.rawListeners("SIGTERM")).toHaveLength(
        (previousListeners.get("SIGTERM")?.length ?? 0) + 1,
      );
    });
    expect(mocks.listen).toHaveBeenCalledExactlyOnceWith({ host: "127.0.0.1", port: 3000 });
  });
});
