// Operator-only host composition, mounted into a reviewed Worker archive. NFR-008/009, SEC-007.
import { readFileSync } from "node:fs";

import { analyzePublicGitHubRepository } from "@stacklens/analysis-orchestration";
import {
  createStackLensDatabase,
  createStackLensPool,
  DrizzleAnalysisRepository,
} from "@stacklens/persistence";

import { createRepositoryAnalysisTaskList, startStackLensWorker } from "./dist/index.js";
import { createWorkerAnalysisDependencies } from "./dist/providers.js";
import { capacityFetch, workloadOptions } from "./worker-capacity-fixtures.mjs";

process.loadEnvFile("/private.env");
const options = workloadOptions(
  process.env.STACKLENS_SOAK_MODE,
  process.env.STACKLENS_WORKER_CONCURRENCY,
  process.env.STACKLENS_SOAK_PROVIDERS,
);
const pool = createStackLensPool(process.env.DATABASE_URL, undefined, { max: 1 });
const repository = new DrizzleAnalysisRepository(createStackLensDatabase(pool));
const active = new Map();
const profiles = new Map();
const readNumber = (path) => Number(readFileSync(path, "utf8").trim());
const counters = (path) =>
  Object.fromEntries(
    readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => line.split(" "))
      .map(([name, value]) => [name, Number(value)]),
  );

function sample() {
  const phase =
    [...new Set(active.values())]
      .toSorted((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      .join("+") || "idle";
  const memory = process.memoryUsage();
  const stat = counters("/sys/fs/cgroup/memory.stat");
  const value = {
    cgroupCurrentBytes: readNumber("/sys/fs/cgroup/memory.current"),
    anonymousBytes: stat.anon,
    fileCacheBytes: stat.file,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
  };
  const profile = profiles.get(phase) ?? { phase, samples: 0 };
  profile.samples++;
  for (const [key, amount] of Object.entries(value))
    profile[key] = Math.max(profile[key] ?? 0, amount);
  profiles.set(phase, profile);
}

const dependencies = (signal) =>
  createWorkerAnalysisDependencies(
    signal,
    process.env.STACKLENS_GITHUB_TOKEN || undefined,
    options.providers === "synthetic" ? capacityFetch : fetch,
  );
let runtime;
let stopping = false;
let timer;
let sampleFailed = false;
let stopPromise;
function observedSample() {
  try {
    sample();
  } catch {
    sampleFailed = true;
  }
}
function stop() {
  stopping = true;
  stopPromise ??= (async () => {
    try {
      await runtime?.stop();
    } catch {
      process.exitCode = 1;
    } finally {
      clearInterval(timer);
      observedSample();
      await pool.end();
      process.stdout.write(
        `${JSON.stringify({ event: "stacklens_worker_capacity", profiles: [...profiles.values()], sampleFailed, memoryPeakBytes: readNumber("/sys/fs/cgroup/memory.peak"), memoryEvents: counters("/sys/fs/cgroup/memory.events") })}\n`,
      );
    }
  })();
  return stopPromise;
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    if (runtime) void stop();
  });
try {
  observedSample();
  timer = setInterval(observedSample, 100);
  timer.unref();
  runtime = await startStackLensWorker({
    connectionString: process.env.DATABASE_URL,
    concurrency: options.concurrency,
    databasePoolOptions: { max: 5 },
    onQueueOwnerId() {
      process.stdout.write("StackLens queue owner started (capacity-fixture).\n");
    },
    taskList: createRepositoryAnalysisTaskList({
      repository,
      analysisDependencies: dependencies(new AbortController().signal),
      createAnalysisDependencies: dependencies,
      async analyze(command, providers) {
        try {
          return await analyzePublicGitHubRepository(command, {
            ...providers,
            async onProgress(progress) {
              active.set(command.analysisId, progress.phase);
              observedSample();
              await providers.onProgress?.(progress);
            },
          });
        } finally {
          active.delete(command.analysisId);
          observedSample();
        }
      },
    }),
  });
  if (stopping) await stop();
  else
    void runtime.runner.promise.then(
      () => {
        if (!stopping) process.exitCode = 1;
        return stop();
      },
      () => {
        process.exitCode = 1;
        return stop();
      },
    );
} catch {
  process.exitCode = 1;
  await stop();
}
