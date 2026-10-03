import { readStackLensPoolOptions } from "@stacklens/persistence";

import { confirmedDeadOwnerId, recoverConfirmedDeadOwner } from "./recovery.js";

void (async () => {
  const ownerId = confirmedDeadOwnerId(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("Recovery requires DATABASE_URL.");
  await recoverConfirmedDeadOwner(
    ownerId,
    process.env.DATABASE_URL,
    readStackLensPoolOptions(process.env),
  );
  process.stdout.write(`Confirmed dead queue owner locks released (${ownerId}).\n`);
})().catch((error: unknown) => {
  process.exitCode = 1;
  const name = error instanceof Error ? error.name : "UnknownError";
  process.stderr.write(
    `StackLens Worker recovery failed (${name}); verify the exact dead Worker and recovery arguments.\n`,
  );
});
