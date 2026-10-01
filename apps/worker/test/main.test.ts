import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { startStackLensWorker } from "../src/runtime.js";

const mocks = vi.hoisted(() => ({
  start: vi.fn<(...args: Parameters<typeof startStackLensWorker>) => Promise<unknown>>(),
  stop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
vi.mock("../src/runtime.js", () => ({
  startStackLensWorker: mocks.start,
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
  vi.stubEnv("STACKLENS_WORKER_CONCURRENCY", undefined);
  vi.stubEnv("STACKLENS_GITHUB_TOKEN", undefined);
  vi.stubEnv("STACKLENS_DATABASE_POOL_MAX", undefined);
  vi.stubEnv("STACKLENS_DATABASE_SSL_CA", undefined);
  mocks.start.mockResolvedValue({ stop: mocks.stop });
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
describe("Worker executable configuration", () => {
  it("forwards hosted database settings and limited concurrency [FR-003, FR-022, SEC-007]", async () => {
    vi.stubEnv("STACKLENS_DATABASE_POOL_MAX", "5");
    vi.stubEnv("STACKLENS_DATABASE_SSL_CA", "fixture CA forwarded to pool validation");
    vi.stubEnv("STACKLENS_WORKER_CONCURRENCY", "1");
    await import("../src/main.js");
    await vi.waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith(
        expect.objectContaining({
          databasePoolOptions: { max: 5, sslCa: "fixture CA forwarded to pool validation" },
          concurrency: 1,
        }),
      ),
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
        expect.objectContaining({ connectionString: expected, concurrency: 2 }),
      );
      expect(process.rawListeners("SIGTERM")).toHaveLength(
        (previousListeners.get("SIGTERM")?.length ?? 0) + 1,
      );
    });
  });
});
