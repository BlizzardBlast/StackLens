import type { DrizzleAnalysisRepository } from "@stacklens/persistence";

export interface AnalysisRetentionPumpOptions {
  readonly repository: Pick<DrizzleAnalysisRepository, "purgeExpiredTerminalAnalyses">;
  readonly now?: () => string;
  readonly intervalMs?: number;
  readonly onError?: (error: unknown) => void;
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

  const run = async (): Promise<void> => {
    if (stopped || running !== undefined) return;
    running = options.repository
      .purgeExpiredTerminalAnalyses((options.now ?? (() => new Date().toISOString()))(), 100)
      .then(() => undefined)
      .catch((error: unknown) => options.onError?.(error));
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
      await running;
    },
  };
}
