import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// Package a reviewed StackLens image only; this is never part of repository analysis.
const image = process.argv[2];
if (image === undefined || !image.startsWith("stacklens-worker:")) {
  throw new Error("Supply the reviewed local stacklens-worker image tag.");
}
const output = resolve(process.argv[3] ?? ".cache/stacklens-worker-silly.tar.gz");
const wrapper = fileURLToPath(new URL("../deploy/silly/start-worker.js", import.meta.url));
const run = promisify(execFile);
const command = `
node -e 'if (JSON.parse(require("node:fs").readFileSync("/app/package.json", "utf8")).name !== "@stacklens/worker") process.exit(1)' &&
mkdir /package/worker &&
cp -a /app/. /package/worker/ &&
mv /package/worker/package.json /package/worker/worker.package.json &&
rm -f /package/worker/tsconfig.json /package/worker/tsconfig.build.json &&
printf '{"type":"module"}\n' > /package/worker/dist/package.json &&
cp /wrapper.js /package/worker/start-worker.js &&
tar -czf - -C /package/worker .
`;
const { stdout } = await run(
  "docker",
  [
    "run",
    "--rm",
    "--read-only",
    "--tmpfs",
    "/package:rw,size=256m",
    "--tmpfs",
    "/tmp",
    "--mount",
    `type=bind,source=${wrapper},target=/wrapper.js,readonly`,
    "--entrypoint",
    "sh",
    image,
    "-c",
    command,
  ],
  { encoding: "buffer", maxBuffer: 150 * 1024 * 1024 },
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, stdout);
process.stdout.write(
  `${JSON.stringify({
    output,
    bytes: stdout.length,
    sha256: createHash("sha256").update(stdout).digest("hex"),
  })}\n`,
);
