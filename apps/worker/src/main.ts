import { readStackLensPoolOptions } from "@stacklens/persistence";

import { startStackLensWorker, type StackLensWorkerRuntime } from "./runtime.js";

const DEFAULT_DATABASE_URL = "postgresql://stacklens:stacklens@127.0.0.1:55432/stacklens";
const DEFAULT_CONCURRENCY = 2;

function environmentInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function optionalEnvironmentSecret(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? undefined : value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
    throw new Error("Production Worker requires DATABASE_URL.");
  }
  const githubToken = optionalEnvironmentSecret("STACKLENS_GITHUB_TOKEN");
  let runtime: StackLensWorkerRuntime | undefined;
  let stopping = false;
  let stopPromise: Promise<void> | undefined;
  const signals = ["SIGINT", "SIGTERM"] as const;
  const removeSignals = (): void => {
    for (const signal of signals) process.removeListener(signal, requestStop);
  };
  const stop = (): Promise<void> => {
    stopPromise ??= (async () => {
      try {
        await runtime?.stop();
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`StackLens Worker shutdown failed (${errorName(error)}).\n`);
      } finally {
        removeSignals();
      }
    })();
    return stopPromise;
  };
  const requestStop = (): void => {
    if (stopping) return;
    stopping = true;
    process.stdout.write("StackLens Worker shutdown requested.\n");
    // A signal during migrations must also stop the runner as soon as startup completes.
    if (runtime !== undefined) void stop();
  };
  for (const signal of signals) process.on(signal, requestStop);
  try {
    runtime = await startStackLensWorker({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
      databasePoolOptions: readStackLensPoolOptions(process.env),
      concurrency: environmentInteger("STACKLENS_WORKER_CONCURRENCY", DEFAULT_CONCURRENCY),
      ...(githubToken === undefined ? {} : { githubToken }),
      onQueueOwnerId(ownerId) {
        process.stdout.write(`StackLens queue owner started (${ownerId}).\n`);
      },
      onDatabasePoolError(error) {
        process.stderr.write(`StackLens Worker database pool error (${errorName(error)}).\n`);
      },
      onRetentionError(error) {
        process.stderr.write(`StackLens retention sweep failed (${errorName(error)}).\n`);
      },
    });
    if (stopping) {
      await stop();
      return;
    }
    void runtime.runner.promise.then(
      () => {
        if (!stopping) {
          stopping = true;
          process.exitCode = 1;
          process.stderr.write("StackLens Worker runner exited unexpectedly.\n");
        }
        return stop();
      },
      (error: unknown) => {
        stopping = true;
        process.exitCode = 1;
        process.stderr.write(`StackLens Worker runner failed (${errorName(error)}).\n`);
        return stop();
      },
    );
  } catch (error) {
    removeSignals();
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`StackLens Worker failed to start (${errorName(error)}).\n`);
});
