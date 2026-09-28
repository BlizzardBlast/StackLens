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
} from "@stacklens/persistence";
import {
  createGraphileRepositoryJobQueue,
  createRepositoryAnalysisDeliveryDispatcher,
  startRepositoryAnalysisDeliveryPump,
  type GraphileJobAdder,
} from "@stacklens/repository-jobs";

import { createRepositoryAnalysisTaskList } from "./task.js";

export interface WorkerRuntimeOptions {
  readonly connectionString: string;
  readonly concurrency?: number;
  readonly githubToken?: string;
  readonly onDatabasePoolError?: (error: Error) => void;
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
  const pool = createStackLensPool(options.connectionString, options.onDatabasePoolError);

  try {
    const database = createStackLensDatabase(pool);
    await migrateStackLensDatabase(database);
    await runMigrations({ pgPool: pool });

    const workerUtils = await makeWorkerUtils({ pgPool: pool });
    let deliveryPump: ReturnType<typeof startRepositoryAnalysisDeliveryPump> | undefined;

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
