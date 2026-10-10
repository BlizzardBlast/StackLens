/* oxlint-disable no-await-in-loop -- Each bounded image attempt finishes before the next retry. */
// NFR-010/009, SEC-007: dependency-free startup diagnostics, without source custody or raw logs.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { pause, readBoundedFile, record } from "./common.mjs";

const image = "postgres:18-alpine";
const attemptTimeoutMs = 60_000;
const retryDelaysMs = [10_000, 20_000];
const outcomes = new Set(["success", "failure", "cancelled", "skipped"]);
const stages = ["checkout", "pnpm", "node", "install", "build", "image", "download", "operation"];

export function pullAttempt({ start = spawn, timeoutMs = attemptTimeoutMs } = {}) {
  return new Promise((done) => {
    let task,
      timer,
      timedOut = false;
    try {
      // No shell, source configuration, output buffers or raw subprocess diagnostics.
      task = start("docker", ["pull", image], { stdio: "ignore", windowsHide: true });
      timer = setTimeout(() => {
        timedOut = true;
        task.kill("SIGKILL");
      }, timeoutMs);
      task.once("error", () => {
        clearTimeout(timer);
        done("failed");
      });
      task.once("close", (code) => {
        clearTimeout(timer);
        done(timedOut ? "timed_out" : code === 0 ? "succeeded" : "failed");
      });
    } catch {
      clearTimeout(timer);
      done("failed");
    }
  });
}

export async function preparePostgresImage({ pull = pullAttempt, wait = pause } = {}) {
  const evidence = {
    status: "failed",
    image,
    attemptLimit: 3,
    attemptTimeoutMs,
    retryDelaysMs,
    attempts: [],
  };
  for (let attempt = 1; attempt <= evidence.attemptLimit; attempt++) {
    let outcome = "failed";
    try {
      const result = await pull();
      if (["succeeded", "failed", "timed_out"].includes(result)) outcome = result;
    } catch {
      // Deliberately discard exceptions: registry errors can contain private response details.
    }
    evidence.attempts.push({ attempt, outcome });
    if (outcome === "succeeded") return { ...evidence, status: "prepared" };
    if (attempt < evidence.attemptLimit) await wait(retryDelaysMs[attempt - 1]);
  }
  return { ...evidence, failureCode: "offsite_postgres_image_pull_failed" };
}

async function readJson(path, maximumBytes = 64 * 1024) {
  try {
    return JSON.parse((await readBoundedFile(path, maximumBytes)).toString());
  } catch {
    return undefined;
  }
}

export async function finalizeStartup({ evidencePath, imagePath, mode, steps }) {
  assert(["capture", "verify"].includes(mode));
  const stepOutcomes = Object.fromEntries(
    stages
      .filter((stage) => steps[stage])
      .map((stage) => {
        const outcome = steps[stage].outcome;
        assert(outcomes.has(outcome), "offsite_startup_outcome_invalid");
        return [stage, outcome];
      }),
  );
  assert(stepOutcomes.operation, "offsite_startup_operation_outcome_missing");
  // A cancelled step can be interrupted after starting: do not claim that it made no resources.
  const operationStarted =
    stepOutcomes.operation === "skipped"
      ? false
      : stepOutcomes.operation === "cancelled"
        ? null
        : true;
  // Operation receipts include one digest per retained report; do not apply the small image bound.
  const receipt = await readJson(evidencePath, 4 * 1024 * 1024);
  const expectedStatus = mode === "capture" ? "verified_capture" : "verified";
  // Keep an actual operation's report coverage and cleanup evidence; never manufacture success.
  const operationReceipt =
    operationStarted !== false &&
    [expectedStatus, "failed"].includes(receipt?.status) &&
    receipt?.phase !== "startup";
  let evidence;
  if (operationReceipt) {
    evidence = receipt;
    if (stepOutcomes.operation !== "success" && evidence.status !== "failed") {
      evidence = { ...evidence, status: "failed", failureCode: "offsite_backup_operation_failed" };
    }
  } else {
    const failureStage = stages.find((stage) =>
      ["failure", "cancelled"].includes(stepOutcomes[stage]),
    );
    evidence = {
      requirementIds: ["NFR-010", "NFR-009", "SEC-007"],
      status: "failed",
      phase: operationStarted === false ? "startup" : "operation",
      mode,
      failureStage: failureStage ?? "operation",
      failureCode:
        operationStarted !== false
          ? "offsite_backup_operation_receipt_unreadable"
          : failureStage === "image"
            ? "offsite_postgres_image_pull_failed"
            : "offsite_backup_startup_failed",
    };
  }
  const preparation = await readJson(imagePath);
  const attempts = preparation?.attempts;
  const safeAttempts =
    Array.isArray(attempts) &&
    attempts.length <= 3 &&
    attempts.every(
      (value, i) =>
        value?.attempt === i + 1 && ["succeeded", "failed", "timed_out"].includes(value.outcome),
    );
  evidence.startup = {
    operationStarted,
    stepOutcomes,
    ...(safeAttempts
      ? { imageAttempts: attempts.map(({ attempt, outcome }) => ({ attempt, outcome })) }
      : {}),
  };
  evidence.finishedAt ??= new Date().toISOString();
  await record(evidencePath, evidence);
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, evidencePath, imagePath, mode] = process.argv.slice(2);
  if (action === "pull") {
    const evidence = await preparePostgresImage();
    await record(evidencePath, evidence);
    if (evidence.status !== "prepared") process.exitCode = 1;
  } else {
    assert.equal(action, "finalize");
    const evidence = await finalizeStartup({
      evidencePath,
      imagePath,
      mode,
      steps: JSON.parse(process.env.OFFSITE_STARTUP_STEPS ?? "{}"),
    });
    if (evidence.status === "failed") process.exitCode = 1;
  }
}
