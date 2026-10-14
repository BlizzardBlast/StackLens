import { afterEach, describe, expect, it, vi } from "vitest";

import { startAnalysisRetentionPump } from "../src/retention.js";

afterEach(() => vi.useRealTimers());

describe("retention maintenance [SEC-003, NFR-009]", () => {
  it("runs bounded sweeps, reports failures, retries and stops its timer", async () => {
    vi.useFakeTimers();
    const purge = vi
      .fn<(now: string, limit?: number) => Promise<number>>()
      .mockRejectedValueOnce(new Error("database failure"))
      .mockResolvedValue(0);
    const onError = vi.fn<(error: unknown) => void>();
    const pump = startAnalysisRetentionPump({
      repository: { purgeExpiredTerminalAnalyses: purge },
      now: () => "2026-10-01T00:00:00.000Z",
      intervalMs: 100,
      onError,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledOnce();
    expect(purge).toHaveBeenCalledWith("2026-10-01T00:00:00.000Z", 100);
    await vi.advanceTimersByTimeAsync(100);
    expect(purge).toHaveBeenCalledTimes(2);
    await pump.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it("does not overlap sweeps and waits for the active query before shutdown", async () => {
    vi.useFakeTimers();
    let resolveQuery: ((count: number) => void) | undefined;
    const purge = vi.fn<(now: string, limit?: number) => Promise<number>>(
      () =>
        new Promise((resolve) => {
          resolveQuery = resolve;
        }),
    );
    const pump = startAnalysisRetentionPump({
      repository: { purgeExpiredTerminalAnalyses: purge },
      intervalMs: 10,
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(purge).toHaveBeenCalledOnce();
    let stopped = false;
    const stopping = pump.stop().then(() => {
      stopped = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped).toBe(false);
    resolveQuery?.(1);
    await stopping;
    await vi.advanceTimersByTimeAsync(100);
    expect(purge).toHaveBeenCalledOnce();
  });
  it("cancels an active credential purge on shutdown without leaving another sweep [FR-100, SEC-003, NFR-009]", async () => {
    vi.useFakeTimers();
    const onError = vi.fn<(error: unknown) => void>();
    const purge = vi.fn<(now: string, signal: AbortSignal) => Promise<number>>(
      (_now, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    const pump = startAnalysisRetentionPump({
      repository: { purgeExpiredTerminalAnalyses: async () => 0 },
      intervalMs: 10,
      purgeExpiredConnections: purge,
      onError,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(purge).toHaveBeenCalledOnce();
    await pump.stop();
    expect(purge.mock.calls[0]?.[1].aborted).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(purge).toHaveBeenCalledOnce();
  });

  it("reports credential cleanup failure and retries after its deadline [FR-100, NFR-009]", async () => {
    vi.useFakeTimers();
    const failure = new Error("credential cleanup timed out");
    const onError = vi.fn<(error: unknown) => void>();
    const purge = vi
      .fn<(now: string, signal: AbortSignal) => Promise<number>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(0);
    const pump = startAnalysisRetentionPump({
      repository: { purgeExpiredTerminalAnalyses: async () => 0 },
      intervalMs: 10,
      purgeExpiredConnections: purge,
      onError,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(10);
    expect(purge).toHaveBeenCalledTimes(2);
    await pump.stop();
  });
});
