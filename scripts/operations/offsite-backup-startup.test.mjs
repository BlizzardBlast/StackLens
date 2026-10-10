// NFR-010/009, SEC-007: transient recovery, bounded failure, and truthful source-free startup receipts.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { finalizeStartup, preparePostgresImage, pullAttempt } from "./offsite-backup-startup.mjs";

await test("NFR-010: a transient image timeout retries once, then stops after recovery", async () => {
  const results = ["timed_out", "succeeded"],
    waits = [];
  const evidence = await preparePostgresImage({
    pull: async () => results.shift(),
    wait: async (ms) => {
      waits.push(ms);
    },
  });
  assert.equal(evidence.status, "prepared");
  assert.deepEqual(evidence.attempts, [
    { attempt: 1, outcome: "timed_out" },
    { attempt: 2, outcome: "succeeded" },
  ]);
  assert.deepEqual(waits, [10_000]);
  assert.equal(evidence.attemptTimeoutMs, 60_000);
});

await test("NFR-010/009, SEC-007: exhausted image retries fail with no private error text", async () => {
  let calls = 0;
  const waits = [];
  const evidence = await preparePostgresImage({
    pull: async () => {
      calls++;
      throw new Error("private-provider-token-marker");
    },
    wait: async (ms) => {
      waits.push(ms);
    },
  });
  assert.equal(calls, 3);
  assert.equal(evidence.status, "failed");
  assert.equal(evidence.failureCode, "offsite_postgres_image_pull_failed");
  assert.deepEqual(waits, [10_000, 20_000]);
  assert(!JSON.stringify(evidence).includes("private-provider-token-marker"));
});

await test("NFR-010: a hung pull process is killed and reaped before retry can proceed", async () => {
  let task,
    closed = false;
  const result = await pullAttempt({
    timeoutMs: 50,
    start: (file, args, options) => {
      assert.equal(file, "docker");
      assert.deepEqual(args, ["pull", "postgres:18-alpine"]);
      assert.equal(options.stdio, "ignore");
      task = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], options);
      task.once("close", () => {
        closed = true;
      });
      return task;
    },
  });
  assert.equal(result, "timed_out");
  assert.equal(task.killed, true);
  assert.equal(closed, true);
});

await test("NFR-009: an unavailable Docker executable has a sanitized failure outcome", async () => {
  assert.equal(
    await pullAttempt({
      start: () => {
        throw new Error("private-process-error-marker");
      },
    }),
    "failed",
  );
});

async function workspace(run) {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-startup-test-"));
  try {
    await run({
      evidencePath: join(directory, "evidence.json"),
      imagePath: join(directory, "image.json"),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function steps(failureStage) {
  const names = ["checkout", "pnpm", "node", "install", "build", "image", "download", "operation"];
  return Object.fromEntries(
    names.map((name, i) => [
      name,
      {
        outcome:
          !failureStage || i < names.indexOf(failureStage)
            ? "success"
            : name === failureStage
              ? "failure"
              : "skipped",
        outputs: { privateMarker: "private-step-output-marker" },
      },
    ]),
  );
}

await test("NFR-010/009: setup and download failures produce evidence without claiming capture, restore or cleanup", async () => {
  await Promise.all(
    ["pnpm", "node", "install", "build", "image", "download"].map((failureStage) =>
      workspace(async (paths) => {
        await writeFile(paths.evidencePath, JSON.stringify({ status: "failed", phase: "startup" }));
        await writeFile(
          paths.imagePath,
          JSON.stringify({
            attempts: [{ attempt: 1, outcome: "failed", rawError: "private-image-log-marker" }],
          }),
        );
        const evidence = await finalizeStartup({
          ...paths,
          mode: "verify",
          steps: steps(failureStage),
        });
        assert.equal(evidence.status, "failed");
        assert.equal(evidence.phase, "startup");
        assert.equal(evidence.failureStage, failureStage);
        assert.equal(evidence.startup.operationStarted, false);
        assert.equal(evidence.ownedDatabaseRemoved, undefined);
        assert.equal(evidence.matchingTables, undefined);
        const text = await readFile(paths.evidencePath, "utf8");
        assert(!text.includes("private-step-output-marker"));
        assert(!text.includes("private-image-log-marker"));
      }),
    ),
  );
});

await test("NFR-010: finalization preserves completed restore coverage and owned cleanup, and actual operation failure", async () => {
  await workspace(async (paths) => {
    const receipt = {
      status: "verified",
      matchingTables: 7,
      strictReportReads: 1,
      apiReportReads: 1,
      ownedDatabaseRemoved: true,
      transientPrivateFilesRemoved: true,
      retainedReportHashes: Array.from({ length: 2000 }, () => "a".repeat(64)),
    };
    await writeFile(paths.evidencePath, JSON.stringify(receipt));
    const evidence = await finalizeStartup({ ...paths, mode: "verify", steps: steps() });
    for (const [name, value] of Object.entries(receipt)) assert.deepEqual(evidence[name], value);
    await writeFile(
      paths.evidencePath,
      JSON.stringify({ status: "failed", failureCode: "offsite_backup_failed" }),
    );
    const failed = await finalizeStartup({ ...paths, mode: "verify", steps: steps("operation") });
    assert.equal(failed.failureCode, "offsite_backup_failed");
    assert.equal(failed.startup.operationStarted, true);
  });
});

await test("NFR-010: missing operation evidence and cancellation cannot manufacture success or no-resource claims", async () => {
  await workspace(async (paths) => {
    const missing = await finalizeStartup({ ...paths, mode: "capture", steps: steps() });
    assert.equal(missing.status, "failed");
    assert.equal(missing.failureCode, "offsite_backup_operation_receipt_unreadable");
    const cancelledSteps = steps();
    cancelledSteps.operation.outcome = "cancelled";
    await writeFile(paths.evidencePath, "invalid receipt");
    const cancelled = await finalizeStartup({ ...paths, mode: "capture", steps: cancelledSteps });
    assert.equal(cancelled.status, "failed");
    assert.equal(cancelled.startup.operationStarted, null);
    assert.equal(cancelled.ownedDatabaseRemoved, undefined);
  });
});

await test("NFR-010/009: the dependency-free finalizer CLI writes failure evidence and exits nonzero", async () => {
  await workspace(async (paths) => {
    await assert.rejects(
      promisify(execFile)(
        process.execPath,
        [
          resolve("scripts/operations/offsite-backup-startup.mjs"),
          "finalize",
          paths.evidencePath,
          paths.imagePath,
          "capture",
        ],
        { env: { ...process.env, OFFSITE_STARTUP_STEPS: JSON.stringify(steps("image")) } },
      ),
      (error) => error.code === 1,
    );
    const evidence = JSON.parse(await readFile(paths.evidencePath, "utf8"));
    assert.equal(evidence.failureCode, "offsite_postgres_image_pull_failed");
    assert.equal(evidence.startup.operationStarted, false);
  });
});
