import { run, runMigrations, type Runner } from "graphile-worker";
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

import { createRepositoryAnalysisTaskList } from "./task.js";

export interface WorkerRuntimeOptions {
  readonly connectionString: string;
  readonly concurrency?: number;
  readonly githubToken?: string;
  readonly onDatabasePoolError?: (error: Error) => void;
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

    const repository = new DrizzleAnalysisRepository(database);
    const taskList = createRepositoryAnalysisTaskList({
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
          await runner.stop();
        } finally {
          await pool.end();
        }
      },
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
