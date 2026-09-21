import { startStackLensWorker } from "./runtime.js";

const DEFAULT_DATABASE_URL = "postgresql://stacklens:stacklens@127.0.0.1:5432/stacklens";
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

async function main(): Promise<void> {
  const runtime = await startStackLensWorker({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    concurrency: environmentInteger("STACKLENS_WORKER_CONCURRENCY", DEFAULT_CONCURRENCY),
    onDatabasePoolError(error) {
      process.stderr.write(`StackLens Worker database pool error (${errorName(error)}).\n`);
    },
  });

  let stopping = false;

  const stop = async (): Promise<void> => {
    if (stopping) {
      return;
    }

    stopping = true;

    try {
      await runtime.stop();
    } catch (error) {
      process.exitCode = 1;
      process.stderr.write(`StackLens Worker shutdown failed (${errorName(error)}).\n`);
    }
  };

  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`StackLens Worker failed to start (${errorName(error)}).\n`);
});
