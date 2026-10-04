// FR-003/006/011, NFR-001/009, SEC-001/002: bounded synthetic HTTP, never repository execution.
import { setTimeout as pause } from "node:timers/promises";

export const capacityRepositoryUrl = "https://github.com/acme/capacity-fixture";
export const capacityCommitSha = "a".repeat(40);
export const capacityPackageCount = 8;
export const capacityResponseBytes = 12 * 1024 * 1024;

const manifest = JSON.stringify({
  name: "capacity-fixture",
  dependencies: Object.fromEntries(
    Array.from({ length: capacityPackageCount }, (_, index) => [
      `capacity-package-${index}`,
      "1.0.0",
    ]),
  ),
});
const blobSha = "b".repeat(40);
const treeSha = "c".repeat(40);

export function streamedPackument(packageName, signal, responseBytes = capacityResponseBytes) {
  const metadata = JSON.stringify({
    name: packageName,
    "dist-tags": { latest: "1.1.0" },
    versions: { "1.0.0": { version: "1.0.0" }, "1.1.0": { version: "1.1.0" } },
    time: { created: "2026-01-01T00:00:00Z", modified: "2026-10-01T00:00:00Z" },
  });
  const prefix = Buffer.from(`${metadata.slice(0, -1)},"readme":"`);
  const suffix = Buffer.from('"}');
  let remaining = responseBytes - prefix.length - suffix.length;
  if (!Number.isSafeInteger(remaining) || remaining < 0)
    throw new Error("invalid_capacity_response_size");
  let started = false;
  return new Response(
    new ReadableStream({
      async pull(controller) {
        signal?.throwIfAborted();
        if (!started) {
          controller.enqueue(prefix);
          started = true;
        } else if (remaining > 0) {
          // Allocate only one 16 KiB transport chunk at a time; no prebuilt large fixture body.
          await pause(1, undefined, { signal });
          const bytes = Math.min(remaining, 16 * 1024);
          controller.enqueue(Buffer.alloc(bytes, "x"));
          remaining -= bytes;
        } else {
          controller.enqueue(suffix);
          controller.close();
        }
      },
    }),
    { headers: { "content-type": "application/json" } },
  );
}

export function capacityFetch(input, init) {
  const url = new URL(input instanceof Request ? input.url : input);
  init?.signal?.throwIfAborted();
  if (url.origin === "https://registry.npmjs.org") {
    const name = decodeURIComponent(url.pathname.slice(1));
    if (!/^capacity-package-[0-7]$/u.test(name)) throw new Error("unexpected_capacity_package");
    return Promise.resolve(streamedPackument(name, init?.signal));
  }
  if (url.href === "https://api.osv.dev/v1/querybatch") {
    const { queries } = JSON.parse(init.body);
    return Promise.resolve(Response.json({ results: queries.map(() => ({})) }));
  }
  const base = "https://api.github.com/repos/acme/capacity-fixture";
  const routes = {
    [base]: {
      name: "capacity-fixture",
      owner: { login: "acme" },
      private: false,
      default_branch: "main",
    },
    [`${base}/commits/main`]: { sha: capacityCommitSha, commit: { tree: { sha: treeSha } } },
    [`${base}/git/trees/${treeSha}?recursive=1`]: {
      truncated: false,
      tree: [
        {
          path: "package.json",
          mode: "100644",
          type: "blob",
          sha: blobSha,
          size: Buffer.byteLength(manifest),
        },
      ],
    },
    [`${base}/git/blobs/${blobSha}`]: {
      sha: blobSha,
      size: Buffer.byteLength(manifest),
      encoding: "base64",
      content: Buffer.from(manifest).toString("base64"),
    },
  };
  const value = routes[url.href];
  if (!value) throw new Error("unexpected_capacity_endpoint");
  return Promise.resolve(Response.json(value));
}

export function workloadOptions(mode = "serial", concurrency = "1", providers = "live") {
  if (!["serial", "burst", "sustained"].includes(mode)) throw new Error("invalid_soak_mode");
  if (!["1", "2"].includes(concurrency)) throw new Error("soak_concurrency_must_be_1_or_2");
  if (!["live", "synthetic"].includes(providers)) throw new Error("invalid_soak_providers");
  return { mode, concurrency: Number(concurrency), providers };
}
