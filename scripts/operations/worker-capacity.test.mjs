// FR-003/006/011/017, NFR-001/009, SEC-001/002/007: repeatable, source-free capacity fixtures.
import assert from "node:assert/strict";
import test from "node:test";

import { createWorkerAnalysisDependencies } from "../../apps/worker/dist/providers.js";
import { analyzePublicGitHubRepository } from "../../packages/analysis-orchestration/dist/index.js";
import { AnalysisReportSchema } from "../../packages/contracts/dist/index.js";
import { settleCapacitySteps } from "./worker-capacity-evidence.mjs";
import {
  capacityCommitSha,
  capacityFetch,
  capacityPackageCount,
  capacityRepositoryUrl,
  streamedPackument,
  workloadOptions,
} from "./worker-capacity-fixtures.mjs";

function smallCapacityFetch(input, init) {
  const url = new URL(input instanceof Request ? input.url : input);
  return url.origin === "https://registry.npmjs.org"
    ? Promise.resolve(
        streamedPackument(decodeURIComponent(url.pathname.slice(1)), init?.signal, 1024),
      )
    : capacityFetch(input, init);
}

void test("NFR-009/SEC-007: bounded workload options reject unsupported modes and concurrency", () => {
  assert.deepEqual(workloadOptions(), { mode: "serial", concurrency: 1, providers: "live" });
  assert.deepEqual(workloadOptions("sustained", "2", "synthetic"), {
    mode: "sustained",
    concurrency: 2,
    providers: "synthetic",
  });
  assert.throws(() => workloadOptions("unbounded"), /invalid_soak_mode/u);
  for (const concurrency of ["0", "3", "1.5", "Infinity"])
    assert.throws(() => workloadOptions("burst", concurrency), /soak_concurrency/u);
  assert.throws(() => workloadOptions("serial", "1", "unknown"), /invalid_soak_providers/u);
});

void test("NFR-009: failed capacity observations preserve successful teardown and safe diagnostics", async () => {
  const attempted = [];
  const result = await settleCapacitySteps([
    ["observeWorker", () => attempted.push("observeWorker"), "observation"],
    ["stopWorker", () => attempted.push("stopWorker")],
    [
      "observeExit",
      () => {
        attempted.push("observeExit");
        throw new Error("private fixture body must not enter evidence");
      },
      "observation",
    ],
    ["removeWorker", () => attempted.push("removeWorker")],
    ["dropOwnedDatabase", () => attempted.push("dropOwnedDatabase")],
  ]);
  assert.deepEqual(attempted, [
    "observeWorker",
    "stopWorker",
    "observeExit",
    "removeWorker",
    "dropOwnedDatabase",
  ]);
  assert.deepEqual(result, {
    observationFailures: ["observeExit"],
    cleanupFailures: [],
    cleanedUp: true,
  });
  assert(!JSON.stringify(result).includes("private fixture body"));
});

void test("NFR-009: observation and cleanup failures remain distinct while later cleanup still runs", async () => {
  let privateFileRemoved = false;
  const result = await settleCapacitySteps([
    [
      "observeExit",
      async () => {
        throw new Error("missing summary");
      },
      "observation",
    ],
    [
      "removeWorker",
      async () => {
        throw new Error("removal failed");
      },
    ],
    [
      "removePrivateEnvironment",
      () => {
        privateFileRemoved = true;
      },
    ],
  ]);
  assert.equal(privateFileRemoved, true);
  assert.deepEqual(result, {
    observationFailures: ["observeExit"],
    cleanupFailures: ["removeWorker"],
    cleanedUp: false,
  });
});

void test("SEC-001/002: fixtures reject unexpected targets and honor interrupted body acquisition", async () => {
  assert.throws(
    () => capacityFetch("https://example.com/private"),
    /unexpected_capacity_endpoint/u,
  );
  assert.throws(
    () => capacityFetch("https://registry.npmjs.org/other"),
    /unexpected_capacity_package/u,
  );
  const controller = new AbortController();
  const response = streamedPackument("capacity-package-0", controller.signal, 32 * 1024);
  const reader = response.body.getReader();
  await reader.read();
  controller.abort();
  await assert.rejects(reader.read(), { name: "AbortError" });
  reader.releaseLock();
});

void test("FR-003/006/011/017, NFR-001: capacity fixture traverses real providers and deterministic analyzer", async () => {
  const dependencies = createWorkerAnalysisDependencies(
    new AbortController().signal,
    undefined,
    smallCapacityFetch,
  );
  const result = await analyzePublicGitHubRepository(
    {
      analysisId: "529183ea-88c8-4fc2-9ab9-a38f52e889ea",
      repositoryUrl: capacityRepositoryUrl,
      createdAt: "2026-10-04T00:00:00Z",
    },
    dependencies,
  );
  assert.equal(result.ok, true);
  AnalysisReportSchema.parse(result.report);
  assert.equal(result.report.input.repository.commitSha, capacityCommitSha);
  assert.equal(result.report.partialFailures.length, 0);
  assert.equal(
    result.report.sources.filter((source) => source.provider === "npm-registry").length,
    capacityPackageCount,
  );
  assert.equal(result.report.sources.filter((source) => source.provider === "osv").length, 1);
});
