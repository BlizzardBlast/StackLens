import type { DrizzleAnalysisRepository } from "@stacklens/persistence";

export interface AnalysisRetentionPumpOptions {
  readonly repository: Pick<DrizzleAnalysisRepository, "purgeExpiredTerminalAnalyses">;
  readonly now?: () => string;
  readonly intervalMs?: number;
  readonly onError?: (error: unknown) => void;
  readonly purgeExpiredConnections?: (now: string, signal: AbortSignal) => Promise<number>;
}

/** SEC-003/NFR-009: one bounded sweep at a time; stop waits before pool shutdown. */
export function startAnalysisRetentionPump(options: AnalysisRetentionPumpOptions): {
  stop(): Promise<void>;
} {
  const intervalMs = options.intervalMs ?? 60_000;
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1) {
    throw new Error("Retention sweep interval must be a positive integer.");
  }
  let stopped = false;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const shutdown = new AbortController();

  const run = async (): Promise<void> => {
    if (stopped || running !== undefined) return;
    const now = (options.now ?? (() => new Date().toISOString()))();
    running = options.repository
      .purgeExpiredTerminalAnalyses(now, 100)
      .then(async () => {
        if (!stopped) await options.purgeExpiredConnections?.(now, shutdown.signal);
      })
      .catch((error: unknown) => {
        if (!shutdown.signal.aborted || error !== shutdown.signal.reason) options.onError?.(error);
      });
    try {
      await running;
    } finally {
      running = undefined;
      if (!stopped) {
        timer = setTimeout(() => {
          void run();
        }, intervalMs);
      }
    }
  };
  void run();

  return {
    async stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      shutdown.abort();
      await running;
    },
  };
}
