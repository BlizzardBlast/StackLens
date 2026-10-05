import { afterEach, describe, expect, it, vi } from "vitest";

import { observeShutdownStage, type WorkerShutdownProgress } from "../src/shutdown.js";

afterEach(() => vi.useRealTimers());

describe("source-free shutdown observations [NFR-008, NFR-009]", () => {
  it("keeps waiting for cleanup, reports elapsed time, and removes its unreferenced timer", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    const progress: WorkerShutdownProgress[] = [];
    let complete!: () => void;
    const shutdown = observeShutdownStage(
      "runner",
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
      (value) => progress.push(value),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(progress).toEqual([
      { stage: "runner", state: "started", elapsedMs: 0 },
      { stage: "runner", state: "waiting", elapsedMs: 5_000 },
      { stage: "runner", state: "waiting", elapsedMs: 10_000 },
    ]);
    complete();
    await shutdown;
    expect(progress.at(-1)).toEqual({ stage: "runner", state: "completed", elapsedMs: 10_000 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["synchronous", "asynchronous"] as const)(
    "preserves %s cleanup failures without exposing their contents",
    async (kind) => {
      vi.useFakeTimers();
      const failure = new Error("private connection and repository details");
      const action =
        kind === "synchronous"
          ? () => {
              throw failure;
            }
          : () => Promise.reject(failure);
      const observer = vi.fn<(progress: WorkerShutdownProgress) => void>();
      await expect(observeShutdownStage("database_pool", action, observer)).rejects.toBe(failure);
      expect(observer.mock.calls.map(([value]) => value.state)).toEqual(["started", "failed"]);
      expect(JSON.stringify(observer.mock.calls)).not.toContain(failure.message);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("cleans up even when the optional diagnostics observer throws", async () => {
    const action = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await observeShutdownStage("worker_utils", action, () => {
      throw new Error("observer failed");
    });
    expect(action).toHaveBeenCalledOnce();
  });
});
