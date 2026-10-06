// NFR-009, SEC-003/007: CLI guards and failed-capture cleanup preserve private/unknown inputs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import test from "node:test";

import { root } from "./common.mjs";

async function failure(action, environment = {}, existing = false) {
  const ownedRoot = resolve(root, ".cache", `portable-guard-${randomUUID()}`);
  // The intermediate parent is absent on every run, even in a warm workstation checkout.
  const directory = resolve(ownedRoot, "fresh-parent", "case");
  await mkdir(directory, { recursive: true });
  const bundle = resolve(directory, "bundle");
  if (existing) {
    await mkdir(bundle);
    await writeFile(resolve(bundle, "unknown.txt"), "preserve-me");
  }
  try {
    const evidence = resolve(directory, "evidence.json");
    const result = spawnSync(
      process.execPath,
      ["scripts/operations/portable-recovery.mjs", action, bundle, evidence],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          STACKLENS_RECOVERY_KEY: randomBytes(32).toString("hex"),
          STACKLENS_RECOVERY_DATABASE: JSON.stringify({
            DATABASE_URL: "postgresql://private-user:private-secret@source.invalid/private-name",
            STACKLENS_DATABASE_SSL_CA: "private-certificate-marker",
          }),
          STACKLENS_ORIGINAL_COMPUTE_OFFLINE: "false",
          ...environment,
        },
      },
    );
    assert.equal(result.status, 1);
    const record = JSON.parse(await readFile(evidence, "utf8"));
    assert.equal(record.status, "failed");
    assert.equal(record.cleanedUp, true);
    for (const marker of [
      "private-user",
      "private-secret",
      "source.invalid",
      "private-certificate-marker",
      environment.STACKLENS_RECOVERY_KEY,
    ].filter(Boolean))
      assert(!`${result.stdout}${result.stderr}${JSON.stringify(record)}`.includes(marker));
    if (existing)
      assert.equal(await readFile(resolve(bundle, "unknown.txt"), "utf8"), "preserve-me");
    else await assert.rejects(readFile(resolve(bundle, "database.slbackup")), { code: "ENOENT" });
  } finally {
    assert.match(relative(resolve(root, ".cache"), ownedRoot), /^portable-guard-[0-9a-f-]{36}$/u);
    await rm(ownedRoot, { recursive: true, force: true });
  }
}

await test("SEC-007: preview capture requires original-compute offline confirmation and private key", async () => {
  await failure("capture-preview");
  await failure("capture-preview", { STACKLENS_RECOVERY_KEY: "invalid-private-key" });
});
await test("SEC-003/007: capture preserves an existing directory and reports complete private cleanup", async () => {
  await failure("capture-fixture", {}, true);
});
await test("NFR-009/SEC-007: malformed source run and unavailable restore inputs fail without leaking configuration", async () => {
  await failure("recover-preview", { STACKLENS_RECOVERY_SOURCE_RUN_ID: "not-a-run-id" });
  await failure("recover-preview", { STACKLENS_RECOVERY_SOURCE_RUN_ID: "123" });
});
