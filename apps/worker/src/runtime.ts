import {
  GitHubRepositoryAdapter,
  NpmRegistryAdapter,
  OsvVulnerabilityAdapter,
} from "@stacklens/data-sources";
import {
  createStackLensDatabase,
  DrizzleAnalysisRepository,
  migrateStackLensDatabase,
} from "@stacklens/persistence";
import { run, runMigrations, type Runner } from "graphile-worker";
import pg from "pg";
import type { Pool as PgPool } from "pg";

const { Pool } = pg;

import { createRepositoryAnalysisTaskList } from "./task.js";

export interface WorkerRuntimeOptions {
  readonly connectionString: string;
  readonly concurrency?: number;
}

export interface StackLensWorkerRuntime {
  readonly pool: PgPool;
  readonly runner: Runner;
  stop(): Promise<void>;
}

export async function startStackLensWorker(
  options: WorkerRuntimeOptions,
): Promise<StackLensWorkerRuntime> {
  const pool = new Pool({ connectionString: options.connectionString });
  pool.on("error", () => undefined);

  const database = createStackLensDatabase(pool);
  await migrateStackLensDatabase(database);
  await runMigrations({ pgPool: pool });

  const repository = new DrizzleAnalysisRepository(database);
  const taskList = createRepositoryAnalysisTaskList({
    repository,
    analysisDependencies: {
      githubRepositoryProvider: new GitHubRepositoryAdapter(),
      npmRegistryProvider: new NpmRegistryAdapter(),
      osvProvider: new OsvVulnerabilityAdapter(),
    },
  });

  const runner = await run({
    pgPool: pool,
    taskList,
    concurrency: options.concurrency ?? 2,
    noHandleSignals: false,
  });

  return {
    pool,
    runner,
    async stop() {
      await runner.stop();
      await pool.end();
    },
  };
}
