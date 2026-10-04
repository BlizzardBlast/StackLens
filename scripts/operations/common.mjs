/* oxlint-disable no-await-in-loop -- Polling waits for each observation before the next bounded interval. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
export const pause = (ms) => new Promise((done) => setTimeout(done, ms));
export const root = resolve(import.meta.dirname, "../..");
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export async function readBoundedFile(path, maximumBytes) {
  const file = await open(path, "r");
  try {
    const detail = await file.stat();
    if (!detail.isFile() || detail.size > maximumBytes)
      throw new Error("operational_file_limit_exceeded");
    const chunks = [];
    let bytes = 0;
    // Enforce the bound again while reading, including files that grow after stat().
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      bytes += chunk.length;
      if (bytes > maximumBytes) throw new Error("operational_file_limit_exceeded");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, bytes);
  } finally {
    await file.close();
  }
}

export async function command(file, args, options = {}) {
  try {
    return await execute(file, args, { timeout: 120_000, maxBuffer: 1024 * 1024, ...options });
  } catch (error) {
    // Subprocess errors can contain credentials, data, command arguments or provider bodies.
    // oxlint-disable-next-line preserve-caught-error -- Subprocess causes can contain credentials or full dump buffers.
    throw new Error(
      error.killed ? "operational_subprocess_timeout" : "operational_subprocess_failed",
    );
  }
}

export async function sourceIdentity() {
  const { stdout } = await command("git", ["rev-parse", "HEAD"], { cwd: root });
  return {
    baseCommit: stdout.trim(),
    sourceHashes: Object.fromEntries(
      await Promise.all(
        [
          "apps/api/src/vercel-runtime.ts",
          "apps/worker/src/runtime.ts",
          "deploy/silly/start-worker.js",
        ].map(async (path) => [path, sha256(await readFile(resolve(root, path)))]),
      ),
    ),
  };
}

export function requireLocalDatabase(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid_database_configuration");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("local_rehearsal_requires_loopback_database");
  }
  return url;
}

export async function readPrivateConfiguration(path) {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (
      !value ||
      typeof value.DATABASE_URL !== "string" ||
      (value.STACKLENS_DATABASE_SSL_CA !== undefined &&
        typeof value.STACKLENS_DATABASE_SSL_CA !== "string") ||
      Object.keys(value).some(
        (name) => !["DATABASE_URL", "STACKLENS_DATABASE_SSL_CA"].includes(name),
      )
    )
      throw new Error();
    if (!["postgres:", "postgresql:"].includes(new URL(value.DATABASE_URL).protocol))
      throw new Error();
    return value;
  } catch {
    throw new Error("invalid_private_database_configuration");
  }
}

export async function record(path, evidence) {
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: evidence.status, output })}\n`);
}

export async function until(check, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await pause(250);
  }
  throw new Error("operational_deadline_exceeded");
}

export async function removePrivateFile(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("private_file_cleanup_failed", { cause: error });
  }
}

export async function cleanupSteps(steps) {
  const failures = [];
  for (const [name, action] of steps) {
    try {
      await action();
    } catch {
      failures.push(name);
    }
  }
  return failures;
}
