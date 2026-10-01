import type { FastifyInstance } from "fastify";
import { makeWorkerUtils } from "graphile-worker";
import type { Pool } from "pg";

import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
  migrateStackLensDatabase,
  type StackLensPoolOptions,
} from "@stacklens/persistence";
import {
  createRepositoryAnalysisDeliveryDispatcher,
  createGraphileRepositoryJobQueue,
  startRepositoryAnalysisDeliveryPump,
  type GraphileJobAdder,
} from "@stacklens/repository-jobs";

import { quickManifestAnalyzer } from "./quick-manifest-analyzer.js";
import { createStackLensApi } from "./server.js";

export interface StackLensApiRuntimeOptions {
  readonly connectionString: string;
  readonly logger?: boolean;
  readonly retentionHours?: number;
  readonly databasePoolOptions?: StackLensPoolOptions;
  readonly onDatabasePoolError?: (error: Error) => void;
  /** Request-bound hosts rely on the continuously running Worker for outbox recovery. */
  readonly startDeliveryPump?: boolean;
  readonly onDatabasePoolCreated?: (pool: Pool) => void;
}

export interface StackLensApiRuntime {
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

export async function createStackLensApiRuntime(
  options: StackLensApiRuntimeOptions,
): Promise<StackLensApiRuntime> {
  const pool = createStackLensPool(
    options.connectionString,
    options.onDatabasePoolError,
    options.databasePoolOptions,
  );

  try {
    options.onDatabasePoolCreated?.(pool);
    const database = createStackLensDatabase(pool);
    await migrateStackLensDatabase(database);

    const workerUtils = await makeWorkerUtils({ pgPool: pool });
    let deliveryPump: ReturnType<typeof startRepositoryAnalysisDeliveryPump> | undefined;

    try {
      await workerUtils.migrate();

      const jobAdder: GraphileJobAdder = {
        async addJob(identifier, payload, jobOptions) {
          return workerUtils.addJob(identifier, payload, jobOptions);
        },
      };
      const repository = new DrizzleAnalysisRepository(database);
      const deliveryDispatcher = createRepositoryAnalysisDeliveryDispatcher({
        repository,
        queue: createGraphileRepositoryJobQueue(jobAdder),
      });
      if (options.startDeliveryPump !== false) {
        deliveryPump = startRepositoryAnalysisDeliveryPump(deliveryDispatcher);
      }
      const app = await createStackLensApi({
        repository,
        deliveryDispatcher,
        quickManifestAnalyzer,
        retentionHours: options.retentionHours ?? 24,
        ...(options.logger === undefined ? {} : { logger: options.logger }),
      });

      let stopped = false;

      return {
        app,
        async stop() {
          if (stopped) {
            return;
          }

          stopped = true;

          try {
            await deliveryPump?.stop();
            await app.close();
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
