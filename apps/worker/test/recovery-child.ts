import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "@stacklens/persistence";

import { startStackLensWorker } from "../src/runtime.js";
import { createRepositoryAnalysisTaskList } from "../src/task.js";
import { recoveryProviders } from "./recovery-fixtures.js";

// Test-only child; never included in the production build or configured task list.
const connectionString = process.env.STACKLENS_RECOVERY_TEST_DATABASE_URL;
if (connectionString === undefined || process.send === undefined)
  throw new Error("Recovery fixture requires isolated database and IPC.");
const pool = createStackLensPool(connectionString);
const repository = new DrizzleAnalysisRepository(createStackLensDatabase(pool));
const runtime = await startStackLensWorker({
  connectionString,
  concurrency: 1,
  retentionCleanup: false,
  onQueueOwnerId(ownerId) {
    process.send?.({ ownerId });
  },
  taskList: createRepositoryAnalysisTaskList({
    repository,
    analysisDependencies: recoveryProviders(),
    createAnalysisDependencies: (signal) => recoveryProviders(signal),
  }),
});
process.send({ ready: true });
process.on("SIGTERM", () => {
  void (async () => {
    try {
      await runtime.stop();
    } finally {
      await pool.end();
    }
  })();
});
