/* oxlint-disable no-await-in-loop -- Bounded pages, authenticated ownership and deletion checks are sequential. */
// NFR-010/009, SEC-003/007: fail stale verification; delete only authenticated owned expired artifacts.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { record } from "./common.mjs";
import {
  authenticateRetentionLabel,
  backupRepository,
  backupVerificationJob,
  backupWorkflowPath,
  maximumVerifiedBackupAgeMs,
  validateBackupMaster,
} from "./offsite-backup-bundle.mjs";

const prefix = `/repos/${backupRepository}/actions`;
async function pages(api, path, field) {
  const values = [],
    seen = new Set();
  for (let page = 1; page <= 10; page++) {
    const value = await api("GET", `${path}?per_page=100&page=${page}`);
    assert(
      value &&
        Number.isSafeInteger(value.total_count) &&
        value.total_count >= 0 &&
        value.total_count <= 1000,
    );
    assert(Array.isArray(value[field]) && value[field].length <= 100);
    for (const item of value[field]) {
      assert(Number.isSafeInteger(item.id) && item.id > 0 && !seen.has(item.id));
      seen.add(item.id);
      values.push(item);
    }
    if (values.length >= value.total_count) return values;
    assert(value[field].length > 0);
  }
  throw new Error("offsite_artifact_listing_incomplete");
}
function trustedRun(run, label) {
  return (
    run &&
    String(run.id) === label.runId &&
    run.repository?.full_name === backupRepository &&
    run.head_repository?.full_name === backupRepository &&
    run.head_branch === "main" &&
    run.head_sha === label.sourceCommit &&
    run.path === backupWorkflowPath &&
    ["schedule", "workflow_dispatch"].includes(run.event)
  );
}
export async function maintainOffsiteBackups({ master, api, now = Date.now() }) {
  validateBackupMaster(master, "preview");
  assert(Number.isFinite(now));
  const result = {
    status: "pending",
    authenticatedArtifacts: 0,
    preservedArtifacts: 0,
    expiredArtifactsRemoved: 0,
    latestVerifiedBackup: null,
    lastAuthenticatedDeadline: null,
  };
  const runs = new Map(),
    jobs = new Map(),
    candidates = [];
  const artifacts = await pages(api, `${prefix}/artifacts`, "artifacts");
  for (const artifact of artifacts) {
    let label;
    try {
      label = authenticateRetentionLabel(master, artifact.name);
    } catch {
      result.preservedArtifacts++;
      continue;
    }
    if (String(artifact.workflow_run?.id) !== label.runId) {
      result.preservedArtifacts++;
      continue;
    }
    if (!runs.has(label.runId))
      runs.set(label.runId, await api("GET", `${prefix}/runs/${label.runId}`));
    if (!trustedRun(runs.get(label.runId), label)) {
      result.preservedArtifacts++;
      continue;
    }
    const uploaded = Date.parse(artifact.created_at);
    assert(Number.isFinite(uploaded) && uploaded >= label.createdAt && uploaded < label.expiresAt);
    assert(label.createdAt <= now, "future_backup_capture");
    result.authenticatedArtifacts++;
    const deadline = new Date(label.expiresAt).toISOString();
    if (!result.lastAuthenticatedDeadline || deadline > result.lastAuthenticatedDeadline)
      result.lastAuthenticatedDeadline = deadline;
    if (label.expiresAt <= now) {
      await api("DELETE", `${prefix}/artifacts/${artifact.id}`);
      assert.equal(
        await api("GET", `${prefix}/artifacts/${artifact.id}`),
        undefined,
        "expired_artifact_delete_not_confirmed",
      );
      result.expiredArtifactsRemoved++;
      continue;
    }
    if (artifact.expired === true) continue;
    if (!jobs.has(label.runId))
      jobs.set(label.runId, await pages(api, `${prefix}/runs/${label.runId}/jobs`, "jobs"));
    const verified = jobs
      .get(label.runId)
      .some(
        (job) =>
          job.name === backupVerificationJob &&
          job.conclusion === "success" &&
          Date.parse(job.started_at) >= uploaded &&
          Date.parse(job.completed_at) >= Date.parse(job.started_at) &&
          Date.parse(job.completed_at) <= now,
      );
    if (verified) candidates.push(label);
  }
  const latest = candidates.toSorted((a, b) => b.createdAt - a.createdAt)[0];
  if (latest)
    result.latestVerifiedBackup = {
      runId: latest.runId,
      sourceCommit: latest.sourceCommit,
      capturedAt: new Date(latest.createdAt).toISOString(),
      expiresAt: new Date(latest.expiresAt).toISOString(),
      ageSeconds: Math.floor((now - latest.createdAt) / 1000),
    };
  result.status =
    latest && now - latest.createdAt <= maximumVerifiedBackupAgeMs ? "verified" : "failed";
  if (result.status === "failed") result.failureCode = "verified_offsite_backup_missing_or_stale";
  return result;
}
export function githubBackupApi(token, request = fetch) {
  assert(typeof token === "string" && token.length > 0);
  return async (method, path) => {
    assert(["GET", "DELETE"].includes(method) && path.startsWith(`${prefix}/`));
    const url = new URL(path, "https://api.github.com");
    assert.equal(url.origin, "https://api.github.com");
    assert(
      /^\/repos\/BlizzardBlast\/StackLens\/actions\/(?:artifacts(?:\/[0-9]+)?|runs\/[0-9]+(?:\/jobs)?)$/u.test(
        url.pathname,
      ),
    );
    if (method === "DELETE") assert(/\/artifacts\/[0-9]+$/u.test(url.pathname));
    const response = await request(url, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (response.status === 404 && method === "GET") {
      await response.body?.cancel();
      return undefined;
    }
    if (response.status === 204 && method === "DELETE") {
      await response.body?.cancel();
      return undefined;
    }
    if (!response.ok || method !== "GET") {
      await response.body?.cancel();
      throw new Error("github_backup_operation_failed");
    }
    assert(response.body, "github_backup_response_missing");
    const chunks = [];
    let bytes = 0;
    try {
      for await (const chunk of response.body) {
        bytes += chunk.length;
        assert(bytes <= 4 * 1024 * 1024, "github_backup_response_limit");
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Error("github_backup_response_invalid");
    }
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const evidence = {
    requirementIds: ["NFR-010", "NFR-009", "SEC-003", "SEC-007"],
    status: "pending",
    startedAt: new Date().toISOString(),
  };
  try {
    assert.equal(process.env.GITHUB_REPOSITORY, backupRepository);
    assert.equal(process.env.GITHUB_REF, "refs/heads/main");
    assert.match(process.env.STACKLENS_BACKUP_MASTER ?? "", /^[0-9a-f]{64}$/u);
    Object.assign(
      evidence,
      await maintainOffsiteBackups({
        master: Buffer.from(process.env.STACKLENS_BACKUP_MASTER, "hex"),
        api: githubBackupApi(process.env.GITHUB_TOKEN),
      }),
    );
  } catch {
    evidence.status = "failed";
    evidence.failureCode = "offsite_backup_maintenance_failed";
  }
  evidence.finishedAt = new Date().toISOString();
  await record(process.argv[2] ?? ".cache/operations/offsite-backup-maintenance.json", evidence);
  if (evidence.status !== "verified") process.exitCode = 1;
}
