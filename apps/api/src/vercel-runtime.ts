import { attachDatabasePool } from "@vercel/functions";

import { readStackLensPoolOptions } from "@stacklens/persistence";

import { createStackLensApiRuntime, type StackLensApiRuntime } from "./runtime.js";

/** Hosting composition only. Repository execution and delivery recovery stay on the Worker. */
export async function createVercelApiRuntime(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<StackLensApiRuntime> {
  const startedAt = performance.now();
  if (!environment.DATABASE_URL) {
    throw new Error("Vercel API requires DATABASE_URL.");
  }
  const retentionHours = Number(environment.STACKLENS_RETENTION_HOURS ?? "24");
  if (!Number.isSafeInteger(retentionHours) || retentionHours < 1 || retentionHours > 8_760) {
    throw new Error("STACKLENS_RETENTION_HOURS must be an integer from 1 to 8760.");
  }
  const poolOptions = readStackLensPoolOptions(environment);
  const databaseMode = environment.STACKLENS_DATABASE_MODE ?? "bootstrap";
  if (databaseMode !== "bootstrap" && databaseMode !== "worker-managed") {
    throw new Error("STACKLENS_DATABASE_MODE must be bootstrap or worker-managed.");
  }

  const runtime = await createStackLensApiRuntime({
    connectionString: environment.DATABASE_URL,
    databasePoolOptions: {
      ...poolOptions,
      max: poolOptions.max ?? 1,
      // Retire on release so request-bound cleanup does not depend on an idle timer.
      maxUses: 1,
      applicationName: "stacklens-api-vercel-single-use",
    },
    retentionHours,
    logger: false,
    startDeliveryPump: false,
    databaseMode,
    onDatabasePoolCreated: attachDatabasePool,
    onDatabasePoolError(error) {
      process.stderr.write(`StackLens API database pool error (${error.name}).\n`);
    },
  });

  // NFR-009/SEC-007: correlate fresh initialization without request data or credentials.
  const revision = environment.VERCEL_GIT_COMMIT_SHA;
  process.stdout.write(
    `${JSON.stringify({
      event: "stacklens_api_runtime_ready",
      revision: revision !== undefined && /^[a-f0-9]{40}$/iu.test(revision) ? revision : null,
      startupDurationMs: Math.round(performance.now() - startedAt),
    })}\n`,
  );
  return runtime;
}
