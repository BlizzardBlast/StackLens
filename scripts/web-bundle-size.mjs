import { lstat, readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const assetTypes = new Map([
  [".js", "js"],
  [".css", "css"],
]);
const categories = ["js", "css", "all"];

const emptyTotal = () => ({ bytes: 0, gzipBytes: 0 });
const isSize = (value) => Number.isSafeInteger(value) && value >= 0;

/** Check both the per-file ledger and its aggregate before trusting a comparison. */
function validateSnapshot(snapshot, role) {
  if (snapshot?.schemaVersion !== 1 || !snapshot.totals || typeof snapshot.totals !== "object") {
    throw new Error(`Invalid ${role}: expected a web-bundle-size schemaVersion 1 snapshot`);
  }

  for (const category of categories) {
    const total = snapshot.totals[category];
    if (!total || !isSize(total.bytes) || !isSize(total.gzipBytes)) {
      throw new Error(`Invalid ${role} totals for ${category}`);
    }
  }

  if (!Array.isArray(snapshot.assets) || snapshot.assets.length === 0) {
    throw new Error(`Invalid ${role} assets: expected a nonempty asset list`);
  }

  const totals = { js: emptyTotal(), css: emptyTotal(), all: emptyTotal() };
  const paths = new Set();
  for (const asset of snapshot.assets) {
    if (
      !asset ||
      typeof asset.path !== "string" ||
      !asset.path ||
      asset.path.startsWith("/") ||
      asset.path.includes("\\") ||
      asset.path.split("/").some((segment) => ["", ".", ".."].includes(segment)) ||
      paths.has(asset.path) ||
      !assetTypes.has(extname(asset.path)) ||
      asset.type !== assetTypes.get(extname(asset.path)) ||
      !isSize(asset.bytes) ||
      !isSize(asset.gzipBytes)
    ) {
      throw new Error(`Invalid ${role} asset entry`);
    }
    paths.add(asset.path);

    for (const total of [totals[asset.type], totals.all]) {
      total.bytes += asset.bytes;
      total.gzipBytes += asset.gzipBytes;
      if (!isSize(total.bytes) || !isSize(total.gzipBytes)) {
        throw new Error(`Invalid ${role} totals: integer overflow`);
      }
    }
  }

  for (const category of categories) {
    if (
      snapshot.totals[category].bytes !== totals[category].bytes ||
      snapshot.totals[category].gzipBytes !== totals[category].gzipBytes
    ) {
      throw new Error(`Invalid ${role} totals for ${category}: do not match assets`);
    }
  }
}

export async function measureWebBundle(directory) {
  const root = resolve(directory);
  // A symlink selected as the output root must not silently measure another directory.
  if ((await lstat(root)).isSymbolicLink()) {
    throw new Error(`Refusing symlink for build output root: ${root}`);
  }
  const assets = [];

  async function walk(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = join(folder, entry.name);
        const assetPath = relative(root, absolutePath).split(sep).join("/");
        if (entry.isSymbolicLink()) {
          throw new Error(`Refusing symlink in build output: ${assetPath}`);
        }
        if (entry.isDirectory()) {
          await walk(absolutePath);
        } else if (entry.isFile()) {
          const type = assetTypes.get(extname(entry.name));
          if (!type) return;
          const content = await readFile(absolutePath);
          assets.push({
            path: assetPath,
            type,
            bytes: content.length,
            gzipBytes: gzipSync(content).length,
          });
        }
      }),
    );
  }

  await walk(root);
  assets.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (assets.length === 0) {
    throw new Error(
      `No JavaScript or CSS assets found in ${root}; run the production web build first`,
    );
  }

  const totals = { js: emptyTotal(), css: emptyTotal(), all: emptyTotal() };
  for (const asset of assets) {
    for (const total of [totals[asset.type], totals.all]) {
      total.bytes += asset.bytes;
      total.gzipBytes += asset.gzipBytes;
    }
  }
  return { schemaVersion: 1, assets, totals };
}

export function compareWebBundles(current, baseline) {
  validateSnapshot(current, "current snapshot");
  validateSnapshot(baseline, "baseline");
  const comparison = {};
  for (const category of categories) {
    const previous = baseline.totals[category];
    const now = current.totals[category];
    comparison[category] = {
      bytesDelta: now.bytes - previous.bytes,
      gzipBytesDelta: now.gzipBytes - previous.gzipBytes,
    };
  }
  return comparison;
}

function parseArgs(args) {
  const options = { dir: "apps/web/dist", compare: undefined };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !["--dir", "--compare"].includes(flag) ||
      seen.has(flag) ||
      !value ||
      value.startsWith("--")
    ) {
      throw new Error(
        "Usage: node scripts/web-bundle-size.mjs [--dir BUILD_DIR] [--compare BASELINE_JSON]",
      );
    }
    seen.add(flag);
    options[flag.slice(2)] = value;
  }
  return options;
}

async function main(args) {
  const { dir, compare } = parseArgs(args);
  const snapshot = await measureWebBundle(dir);
  if (compare) {
    const baseline = JSON.parse(await readFile(compare, "utf8"));
    snapshot.comparison = compareWebBundles(snapshot, baseline);
  }
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
