import { EventEmitter } from "node:events";

import {
  makeWorkerUtils,
  run,
  runMigrations,
  type Runner,
  type TaskList,
  type WorkerEvents,
} from "graphile-worker";
import type { Pool } from "pg";

import { connectedGitHubToken, connectionKey, GitHubConnectionError } from "@stacklens/github-auth";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
  DrizzleGitHubConnectionStore,
  migrateStackLensDatabase,
  type StackLensPoolOptions,
} from "@stacklens/persistence";
import {
  createGraphileRepositoryJobQueue,
  createRepositoryAnalysisDeliveryDispatcher,
  startRepositoryAnalysisDeliveryPump,
  type GraphileJobAdder,
} from "@stacklens/repository-jobs";

import { createWorkerAnalysisDependencies } from "./providers.js";
import { startAnalysisRetentionPump } from "./retention.js";
import { observeShutdownStage, type WorkerShutdownProgress } from "./shutdown.js";
import { createRepositoryAnalysisTaskList } from "./task.js";

export interface WorkerRuntimeOptions {
  readonly githubSessionKey?: string;
  readonly connectionString: string;
  readonly concurrency?: number;
  readonly databasePoolOptions?: StackLensPoolOptions;
  readonly githubToken?: string;
  readonly onDatabasePoolError?: (error: Error) => void;
  readonly onRetentionError?: (error: unknown) => void;
  readonly onQueueOwnerId?: (ownerId: string) => void;
  readonly onShutdownProgress?: (progress: WorkerShutdownProgress) => void;
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
    if (options.githubSessionKey !== undefined) connectionKey(options.githubSessionKey);
    await migrateStackLensDatabase(database);
    await runMigrations({ pgPool: pool });

    const workerUtils = await makeWorkerUtils({ pgPool: pool });
    let deliveryPump: ReturnType<typeof startRepositoryAnalysisDeliveryPump> | undefined;
    let retentionPump: ReturnType<typeof startAnalysisRetentionPump> | undefined;

    try {
      const repository = new DrizzleAnalysisRepository(database);
      const connections = new DrizzleGitHubConnectionStore(database);
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
          analysisDependencies: createWorkerAnalysisDependencies(
            new AbortController().signal,
            options.githubToken,
          ),
          createAnalysisDependencies: (signal) =>
            createWorkerAnalysisDependencies(signal, options.githubToken),
          createConnectedAnalysisDependencies(analysis, signal) {
            if (
              options.githubSessionKey === undefined ||
              analysis.ownerGithubId === undefined ||
              analysis.githubConnectionId === undefined
            )
              throw new GitHubConnectionError();
            const key = options.githubSessionKey,
              owner = analysis.ownerGithubId,
              connectionId = analysis.githubConnectionId;
            return createWorkerAnalysisDependencies(signal, undefined, fetch, {
              repositoryUrl: analysis.repositoryUrl,
              async getToken(lookupSignal) {
                signal.throwIfAborted();
                const token = await connectedGitHubToken(
                  connections,
                  key,
                  owner,
                  connectionId,
                  undefined,
                  lookupSignal,
                );
                signal.throwIfAborted();
                return token;
              },
            });
          },
        });

      const events = new EventEmitter() as WorkerEvents;
      events.on("pool:create", ({ workerPool }) => options.onQueueOwnerId?.(workerPool.id));
      const runner = await run({
        pgPool: pool,
        taskList,
        concurrency: options.concurrency ?? 2,
        noHandleSignals: true,
        gracefulShutdownAbortTimeout: 1_000,
        events,
        // In Graphile 0.18 the immediate completion/failure callbacks are fire-and-forget.
        // Zero-delay batching gives shutdown a releaser that awaits the final queue writes.
        preset: { worker: { completeJobBatchDelay: 0, failJobBatchDelay: 0 } },
      });
      if (options.retentionCleanup ?? true) {
        retentionPump = startAnalysisRetentionPump({
          repository,
          purgeExpiredConnections: (now, signal) => connections.purgeExpired(now, signal),
          ...(options.onRetentionError === undefined ? {} : { onError: options.onRetentionError }),
        });
      }

      let stopPromise: Promise<void> | undefined;

      return {
        pool,
        runner,
        stop() {
          stopPromise ??= (async () => {
            try {
              // Stop claiming jobs immediately, even if a maintenance query is still running.
              const results = await Promise.allSettled([
                observeShutdownStage("runner", () => runner.stop(), options.onShutdownProgress),
                observeShutdownStage(
                  "delivery",
                  () => deliveryPump?.stop(),
                  options.onShutdownProgress,
                ),
                observeShutdownStage(
                  "retention",
                  () => retentionPump?.stop(),
                  options.onShutdownProgress,
                ),
              ]);
              const failures = results.filter((result) => result.status === "rejected");
              if (failures.length > 0) {
                throw new AggregateError(
                  failures.map((failure) => failure.reason),
                  "Worker shutdown failed.",
                );
              }
            } finally {
              try {
                await observeShutdownStage(
                  "worker_utils",
                  () => workerUtils.release(),
                  options.onShutdownProgress,
                );
              } finally {
                await observeShutdownStage(
                  "database_pool",
                  () => pool.end(),
                  options.onShutdownProgress,
                );
              }
            }
          })();
          return stopPromise;
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
