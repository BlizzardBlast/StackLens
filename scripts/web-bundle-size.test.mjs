import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import { compareWebBundles, measureWebBundle } from "./web-bundle-size.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "web-bundle-size.mjs");

async function withOutput(callback) {
  const directory = await mkdtemp(join(tmpdir(), "stacklens-web-size-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const write = async (directory, path, content) => {
  const full = join(directory, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content);
};

test("[GOV-007] measures gzipped JS/CSS assets independently with stable paths", async () => {
  await withOutput(async (dir) => {
    await write(dir, "assets/z.js", "export const b = 1;\n");
    await write(dir, "assets/a.css", "body { color: red; }\n");
    await write(dir, "assets/z.js.map", "not a loaded JavaScript file");
    await write(dir, "index.html", "<html></html>");

    const snapshot = await measureWebBundle(dir);
    assert.equal(snapshot.schemaVersion, 1);
    assert.deepEqual(snapshot.assets.map(({ path }) => path), ["assets/a.css", "assets/z.js"]);
    const js = Buffer.from("export const b = 1;\n");
    const css = Buffer.from("body { color: red; }\n");
    assert.deepEqual(snapshot.totals.js, { bytes: js.length, gzipBytes: gzipSync(js).length });
    assert.deepEqual(snapshot.totals.css, { bytes: css.length, gzipBytes: gzipSync(css).length });
    assert.equal(snapshot.totals.all.gzipBytes, gzipSync(js).length + gzipSync(css).length);
    assert.deepEqual(await measureWebBundle(dir), snapshot);
  });
});

test("[GOV-007] compares aggregate bytes even when hashed asset names change", async () => {
  await withOutput(async (dir) => {
    await write(dir, "assets/app-aaa.js", "a".repeat(100));
    const baseline = await measureWebBundle(dir);
    await rm(join(dir, "assets/app-aaa.js"));
    await write(dir, "assets/app-bbb.js", "b".repeat(200));
    const current = await measureWebBundle(dir);
    const delta = compareWebBundles(current, baseline);
    assert.equal(delta.js.bytesDelta, 100);
    assert.equal(
      delta.all.gzipBytesDelta,
      current.totals.all.gzipBytes - baseline.totals.all.gzipBytes,
    );
    assert.deepEqual(delta.css, { bytesDelta: 0, gzipBytesDelta: 0 });
    assert.throws(
      () => compareWebBundles(current, { schemaVersion: 2, totals: baseline.totals }),
      /Invalid baseline/,
    );
    assert.throws(
      () => compareWebBundles(current, { schemaVersion: 1, totals: { js: { bytes: -1 } } }),
      /Invalid baseline totals/,
    );
  });
});

test("[GOV-007] fails safely for missing assets and symlinks", async () => {
  await withOutput(async (dir) => {
    await assert.rejects(() => measureWebBundle(dir), /No JavaScript or CSS assets/);
    await write(dir, "assets/app.js", "app();");
    await symlink(join(dir, "assets/app.js"), join(dir, "linked.js"));
    await assert.rejects(() => measureWebBundle(dir), /Refusing symlink/);
  });
});

test("[GOV-007] CLI emits machine-readable comparisons and rejects bad options", async () => {
  await withOutput(async (dir) => {
    await write(dir, "assets/app.js", "someCode();");
    const initial = spawnSync(process.execPath, [script, "--dir", dir], { encoding: "utf8" });
    assert.equal(initial.status, 0, initial.stderr);
    const baseline = join(dir, "baseline.json");
    await writeFile(baseline, initial.stdout);
    await write(dir, "assets/app.js", "someCode(); newCode();");
    const after = spawnSync(process.execPath, [script, "--dir", dir, "--compare", baseline], {
      encoding: "utf8",
    });
    assert.equal(after.status, 0, after.stderr);
    const result = JSON.parse(after.stdout);
    assert.equal(result.comparison.js.bytesDelta, " newCode();".length);
    assert.ok(Number.isSafeInteger(result.comparison.all.gzipBytesDelta));
    const invalid = spawnSync(process.execPath, [script, "--unknown", "value"], {
      encoding: "utf8",
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Usage:/);
  });
});
