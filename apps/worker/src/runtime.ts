import { makeWorkerUtils, run, runMigrations, type Runner, type TaskList } from "graphile-worker";
import type { Pool } from "pg";

import {
  GitHubRepositoryAdapter,
  NpmRegistryAdapter,
  OsvVulnerabilityAdapter,
} from "@stacklens/data-sources";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
  migrateStackLensDatabase,
  type StackLensPoolOptions,
} from "@stacklens/persistence";
import {
  createGraphileRepositoryJobQueue,
  createRepositoryAnalysisDeliveryDispatcher,
  startRepositoryAnalysisDeliveryPump,
  type GraphileJobAdder,
} from "@stacklens/repository-jobs";

import { startAnalysisRetentionPump } from "./retention.js";
import { createRepositoryAnalysisTaskList } from "./task.js";

export interface WorkerRuntimeOptions {
  readonly connectionString: string;
  readonly concurrency?: number;
  readonly databasePoolOptions?: StackLensPoolOptions;
  readonly githubToken?: string;
  readonly onDatabasePoolError?: (error: Error) => void;
  readonly onRetentionError?: (error: unknown) => void;
  readonly retentionCleanup?: boolean;
  /**
   * Internal composition seam for runtime verification. Production leaves this unset so the
   * repository-analysis task remains the only configured worker task.
   */
  readonly taskList?: TaskList;
}

export interface StackLensWorkerRuntime {
  readonly pool: Pool;
  readonly runner: Runner;
  stop(): Promise<void>;
}

export async function startStackLensWorker(
  options: WorkerRuntimeOptions,
): Promise<StackLensWorkerRuntime> {
  const pool = createStackLensPool(
    options.connectionString,
    options.onDatabasePoolError,
    options.databasePoolOptions,
  );

  try {
    const database = createStackLensDatabase(pool);
    await migrateStackLensDatabase(database);
    await runMigrations({ pgPool: pool });

    const workerUtils = await makeWorkerUtils({ pgPool: pool });
    let deliveryPump: ReturnType<typeof startRepositoryAnalysisDeliveryPump> | undefined;
    let retentionPump: ReturnType<typeof startAnalysisRetentionPump> | undefined;

    try {
      const repository = new DrizzleAnalysisRepository(database);
      const jobAdder: GraphileJobAdder = {
        async addJob(identifier, payload, jobOptions) {
          return workerUtils.addJob(identifier, payload, jobOptions);
        },
      };
      deliveryPump = startRepositoryAnalysisDeliveryPump(
        createRepositoryAnalysisDeliveryDispatcher({
          repository,
          queue: createGraphileRepositoryJobQueue(jobAdder),
        }),
      );
      const taskList =
        options.taskList ??
        createRepositoryAnalysisTaskList({
          repository,
          analysisDependencies: {
            githubRepositoryProvider: new GitHubRepositoryAdapter({
              authToken: options.githubToken,
            }),
            npmRegistryProvider: new NpmRegistryAdapter(),
            osvProvider: new OsvVulnerabilityAdapter(),
          },
        });

      const runner = await run({
        pgPool: pool,
        taskList,
        concurrency: options.concurrency ?? 2,
        noHandleSignals: true,
      });
      if (options.retentionCleanup ?? true) {
        retentionPump = startAnalysisRetentionPump({
          repository,
          ...(options.onRetentionError === undefined ? {} : { onError: options.onRetentionError }),
        });
      }

      let stopped = false;

      return {
        pool,
        runner,
        async stop() {
          if (stopped) {
            return;
          }

          stopped = true;

          try {
            await deliveryPump?.stop();
            await retentionPump?.stop();
            await runner.stop();
          } finally {
            try {
              await workerUtils.release();
            } finally {
              await pool.end();
            }
          }
        },
      };
    } catch (error) {
      try {
        await deliveryPump?.stop();
        await retentionPump?.stop();
      } finally {
        await workerUtils.release();
      }
      throw error;
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
}
