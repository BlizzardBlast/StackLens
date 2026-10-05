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
const registration = vi.spyOn(process, "on");
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
  mocks.start.mockResolvedValue({
    stop: mocks.stop,
    runner: { promise: new Promise<void>(() => {}) },
  });
  mocks.stop.mockResolvedValue(undefined);
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
  it("records the actual signal and completes only after cleanup settles [NFR-008, NFR-009]", async () => {
    const output = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    let completed!: () => void;
    mocks.stop.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completed = resolve;
        }),
    );
    try {
      await import("../src/main.js");
      await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
      const handler = registration.mock.calls.findLast(([signal]) => signal === "SIGINT")?.[1];
      handler?.();
      handler?.();
      expect(mocks.stop).toHaveBeenCalledOnce();
      const text = (): string => output.mock.calls.map(([value]) => String(value)).join("");
      expect(text()).toContain('"signal":"SIGINT","startupPending":false');
      expect(text()).not.toContain("shutdown completed");
      const options = mocks.start.mock.calls[0]?.[0];
      options?.onShutdownProgress?.({ stage: "database_pool", state: "completed", elapsedMs: 13 });
      expect(text()).toContain(
        '"event":"stacklens_worker_shutdown","stage":"database_pool","state":"completed","elapsedMs":13',
      );
      completed();
      await vi.waitFor(() => expect(text()).toContain("shutdown completed"));
      expect(process.rawListeners("SIGINT")).toEqual(previousListeners.get("SIGINT"));
    } finally {
      completed?.();
      output.mockRestore();
    }
  });
  it("handles repeated signals during startup and waits for one shutdown [NFR-008]", async () => {
    let started: ((value: unknown) => void) | undefined;
    mocks.start.mockImplementation(
      () =>
        new Promise((resolve) => {
          started = resolve;
        }),
    );
    await import("../src/main.js");
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledOnce());
    const handler = registration.mock.calls.findLast(([signal]) => signal === "SIGTERM")?.[1];
    expect(handler).toBeDefined();
    handler?.();
    handler?.();
    expect(mocks.stop).not.toHaveBeenCalled();
    started?.({ stop: mocks.stop });
    await vi.waitFor(() => expect(mocks.stop).toHaveBeenCalledOnce());
    expect(process.rawListeners("SIGTERM")).toEqual(previousListeners.get("SIGTERM"));
  });
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
