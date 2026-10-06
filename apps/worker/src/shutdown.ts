// NFR-008/009: diagnose cleanup without changing its ordering or forcing process exit.
export interface WorkerShutdownProgress {
  readonly stage: "runner" | "delivery" | "retention" | "worker_utils" | "database_pool";
  readonly state: "started" | "waiting" | "completed" | "failed";
  readonly elapsedMs: number;
}

export async function observeShutdownStage(
  stage: WorkerShutdownProgress["stage"],
  action: () => void | PromiseLike<void>,
  observer: ((progress: WorkerShutdownProgress) => void) | undefined,
): Promise<void> {
  const startedAt = performance.now();
  const emit = (state: WorkerShutdownProgress["state"]): void => {
    try {
      observer?.({
        stage,
        state,
        elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    } catch {
      // An optional diagnostics observer must never prevent resource cleanup.
    }
  };
  emit("started");
  const waiting = observer === undefined ? undefined : setInterval(() => emit("waiting"), 5_000);
  waiting?.unref();
  try {
    await action();
    emit("completed");
  } catch (error) {
    emit("failed");
    throw error;
  } finally {
    clearInterval(waiting);
  }
}
