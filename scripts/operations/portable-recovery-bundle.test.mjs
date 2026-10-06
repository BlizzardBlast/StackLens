// SEC-003/007, NFR-009: wrong keys, swapped artifacts and forged exit receipts fail closed.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { encryptArchive } from "./backup-envelope.mjs";
import { sha256 } from "./common.mjs";
import { authenticateRecoveryBundle, fixtureKey } from "./portable-recovery-bundle.mjs";

const now = Date.now();
const header = {
  version: 1,
  createdAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 86_400_000).toISOString(),
};
function bundle(key = randomBytes(32), change = (value) => value) {
  const archive = encryptArchive(Buffer.from("synthetic dump"), key, header);
  const value = change({
    version: 1,
    scope: "preview",
    sourceCommit: "a".repeat(40),
    runId: "123",
    archiveSha256: sha256(archive),
    fingerprintAlgorithm: "postgres-jsonb-c-v1",
    source: Object.fromEntries(
      [
        "public.analysis",
        "public.analysis_report",
        "public.analysis_delivery",
        "graphile_worker._private_jobs",
        "graphile_worker._private_job_queues",
        "graphile_worker._private_tasks",
        "graphile_worker.migrations",
      ].map((name) => [name, { count: 0, sha256: "b".repeat(64) }]),
    ),
    executor: { kind: "operator_confirmed_offline_drained" },
    fixture: null,
  });
  return {
    key,
    archive,
    metadata: encryptArchive(Buffer.from(JSON.stringify(value)), key, header),
  };
}
const open = (b, scope = "preview", runId = "123", time = now) =>
  authenticateRecoveryBundle(b.archive, b.metadata, b.key, scope, runId, time);
await test("SEC-003/007: authentic matching bundle opens only within its restore window", () => {
  const b = bundle();
  assert.equal(open(b).value.runId, "123");
  assert.throws(() => open(b, "preview", "123", now + 86_400_000), /unreadable_or_expired/u);
});
await test("SEC-007: tampering, wrong key and ciphertext substitution are rejected", () => {
  const b = bundle(),
    other = bundle(b.key);
  assert.throws(() => open({ ...b, key: randomBytes(32) }), /unreadable_or_expired/u);
  assert.throws(() => open({ ...b, archive: other.archive }), /unreadable_or_expired/u);
  b.metadata[b.metadata.length - 1] ^= 1;
  assert.throws(() => open(b), /unreadable_or_expired/u);
});
await test("NFR-008/009: scope, source run, exit receipt and queue quarantine cannot be bypassed", () => {
  assert.throws(() => open(bundle(), "fixture"), /unreadable_or_expired/u);
  assert.throws(() => open(bundle(), "preview", "456"), /unreadable_or_expired/u);
  assert.throws(() => open(bundle(fixtureKey)), /unreadable_or_expired/u);
  for (const change of [
    (value) => ({ ...value, executor: { kind: "still_running" } }),
    (value) => ({ ...value, secret: "do-not-expose" }),
    (value) => ({
      ...value,
      source: {
        ...value.source,
        "graphile_worker._private_jobs": { count: 1, sha256: "b".repeat(64) },
      },
    }),
  ])
    assert.throws(() => open(bundle(randomBytes(32), change)), /unreadable_or_expired/u);
});
