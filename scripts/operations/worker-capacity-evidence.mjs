// NFR-009: measurement failures must not misreport removal of owned resources.
import { cleanupSteps } from "./common.mjs";

export async function settleCapacitySteps(steps) {
  const observationFailures = [];
  const cleanupFailures = await cleanupSteps(
    steps.map(([name, action, kind]) => [
      name,
      kind === "observation"
        ? async () => {
            try {
              await action();
            } catch {
              observationFailures.push(name);
            }
          }
        : action,
    ]),
  );
  return { observationFailures, cleanupFailures, cleanedUp: cleanupFailures.length === 0 };
}
