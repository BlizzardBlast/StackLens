// SEC-007/NFR-009: malformed private operator input never enters error diagnostics.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { readPrivateConfiguration, requireLocalDatabase } from "./common.mjs";

void test("SEC-007: configuration errors omit credentials and local rehearsals reject remote targets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-private-configuration-"));
  const path = join(directory, "database.json");
  const secret = "fixture-password-marker";
  const rejectsPrivately = (error) =>
    error.message === "invalid_private_database_configuration" &&
    !error.stack.includes(secret) &&
    error.cause === undefined;
  try {
    await writeFile(path, `{"DATABASE_URL":"postgresql://fixture:${secret}@127.0.0.1/test"`);
    await assert.rejects(readPrivateConfiguration(path), rejectsPrivately);
    await writeFile(path, JSON.stringify({ DATABASE_URL: secret }));
    await assert.rejects(readPrivateConfiguration(path), rejectsPrivately);
    await writeFile(
      path,
      JSON.stringify({
        DATABASE_URL: "postgresql://127.0.0.1/test",
        STACKLENS_GITHUB_TOKEN: secret,
      }),
    );
    await assert.rejects(readPrivateConfiguration(path), rejectsPrivately);
    await writeFile(path, JSON.stringify({ DATABASE_URL: "postgresql://127.0.0.1/test" }));
    assert.equal(
      (await readPrivateConfiguration(path)).DATABASE_URL,
      "postgresql://127.0.0.1/test",
    );
    assert.throws(() => requireLocalDatabase(secret), /invalid_database_configuration/u);
    assert.throws(
      () => requireLocalDatabase(`postgresql://fixture:${secret}@database.example/test`),
      /local_rehearsal_requires_loopback_database/u,
    );
  } finally {
    assert.equal(dirname(directory), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
