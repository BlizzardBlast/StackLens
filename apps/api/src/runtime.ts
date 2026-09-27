import type { FastifyInstance } from "fastify";
import { makeWorkerUtils } from "graphile-worker";

import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
  migrateStackLensDatabase,
} from "@stacklens/persistence";
import {
  createGraphileRepositoryJobQueue,
  type GraphileJobAdder,
} from "@stacklens/repository-jobs";

import { quickManifestAnalyzer } from "./quick-manifest-analyzer.js";
import { createStackLensApi } from "./server.js";

export interface StackLensApiRuntimeOptions {
  readonly connectionString: string;
  readonly logger?: boolean;
  readonly onDatabasePoolError?: (error: Error) => void;
}

export interface StackLensApiRuntime {
  readonly app: FastifyInstance;
  stop(): Promise<void>;
}

export async function createStackLensApiRuntime(
  options: StackLensApiRuntimeOptions,
): Promise<StackLensApiRuntime> {
  const pool = createStackLensPool(options.connectionString, options.onDatabasePoolError);

  try {
    const database = createStackLensDatabase(pool);
    await migrateStackLensDatabase(database);

    const workerUtils = await makeWorkerUtils({ pgPool: pool });

    try {
      await workerUtils.migrate();

      const jobAdder: GraphileJobAdder = {
        async addJob(identifier, payload, jobOptions) {
          return workerUtils.addJob(identifier, payload, jobOptions);
        },
      };
      const app = await createStackLensApi({
        repository: new DrizzleAnalysisRepository(database),
        queue: createGraphileRepositoryJobQueue(jobAdder),
        quickManifestAnalyzer,
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
      await workerUtils.release();
      throw error;
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
}
