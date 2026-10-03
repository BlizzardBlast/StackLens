import { makeWorkerUtils } from "graphile-worker";

import { createStackLensPool, type StackLensPoolOptions } from "@stacklens/persistence";

/** NFR-008/009: a one-shot operator action, never an automatic startup or public endpoint. */
export function confirmedDeadOwnerId(args: readonly string[]): string {
  if (
    args.length !== 2 ||
    args[0] !== "--confirmed-dead-owner" ||
    !/^(?:pool|worker)-[0-9a-f]{18}$/u.test(args[1] ?? "")
  ) {
    throw new Error(
      "Supply exactly one --confirmed-dead-owner pool/worker-<18 lowercase hex digits> after verifying that process has exited.",
    );
  }
  return args[1]!;
}

export async function recoverConfirmedDeadOwner(
  ownerId: string,
  connectionString: string,
  databasePoolOptions: StackLensPoolOptions,
): Promise<void> {
  confirmedDeadOwnerId(["--confirmed-dead-owner", ownerId]);
  const pool = createStackLensPool(connectionString, undefined, { ...databasePoolOptions, max: 1 });
  try {
    const utils = await makeWorkerUtils({ pgPool: pool });
    try {
      await utils.forceUnlockWorkers([ownerId]);
    } finally {
      await utils.release();
    }
  } finally {
    await pool.end();
  }
}
