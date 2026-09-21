import { createStackLensApiRuntime } from "./runtime.js";

const DEFAULT_DATABASE_URL = "postgresql://stacklens:stacklens@127.0.0.1:5432/stacklens";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;

function environmentInteger(name: string, fallback: number, maximum?: number): number {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isSafeInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    throw new Error(
      `${name} must be a positive integer${maximum === undefined ? "" : ` <= ${maximum}`}.`,
    );
  }

  return value;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

async function main(): Promise<void> {
  const runtime = await createStackLensApiRuntime({
    connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    logger: true,
    onDatabasePoolError(error) {
      process.stderr.write(`StackLens API database pool error (${errorName(error)}).\n`);
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
      process.stderr.write(`StackLens API shutdown failed (${errorName(error)}).\n`);
    }
  };

  process.once("SIGINT", () => {
    void stop();
  });
  process.once("SIGTERM", () => {
    void stop();
  });

  try {
    await runtime.app.listen({
      host: process.env.STACKLENS_API_HOST ?? DEFAULT_HOST,
      port: environmentInteger("STACKLENS_API_PORT", DEFAULT_PORT, 65_535),
    });
  } catch (error) {
    await stop();
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`StackLens API failed to start (${errorName(error)}).\n`);
});
