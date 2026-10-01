import { attachDatabasePool } from "@vercel/functions";

import { readStackLensPoolOptions } from "@stacklens/persistence";

import { createStackLensApiRuntime, type StackLensApiRuntime } from "./runtime.js";

/** Hosting composition only. Repository execution and delivery recovery stay on the Worker. */
export async function createVercelApiRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<StackLensApiRuntime> {
  if (!environment.DATABASE_URL) {
    throw new Error("Vercel API requires DATABASE_URL.");
  }
  const retentionHours = Number(environment.STACKLENS_RETENTION_HOURS ?? "24");
  if (!Number.isSafeInteger(retentionHours) || retentionHours < 1 || retentionHours > 8_760) {
    throw new Error("STACKLENS_RETENTION_HOURS must be an integer from 1 to 8760.");
  }
  const poolOptions = readStackLensPoolOptions(environment);

  return createStackLensApiRuntime({
    connectionString: environment.DATABASE_URL,
    databasePoolOptions: { ...poolOptions, max: poolOptions.max ?? 1 },
    retentionHours,
    logger: false,
    startDeliveryPump: false,
    onDatabasePoolCreated: attachDatabasePool,
    onDatabasePoolError(error) {
      process.stderr.write(`StackLens API database pool error (${error.name}).\n`);
    },
  });
}
