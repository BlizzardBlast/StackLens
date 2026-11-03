import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const assetTypes = new Map([
  [".js", "js"],
  [".css", "css"],
]);
const categories = ["js", "css", "all"];

const emptyTotal = () => ({ bytes: 0, gzipBytes: 0 });

export async function measureWebBundle(directory) {
  const root = resolve(directory);
  const assets = [];

  async function walk(folder) {
    const entries = await readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(folder, entry.name);
      const assetPath = relative(root, absolutePath).split(sep).join("/");
      if (entry.isSymbolicLink()) {
        throw new Error(`Refusing symlink in build output: ${assetPath}`);
      }
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        const type = assetTypes.get(extname(entry.name));
        if (!type) continue;
        const content = await readFile(absolutePath);
        assets.push({
          path: assetPath,
          type,
          bytes: content.length,
          gzipBytes: gzipSync(content).length,
        });
      }
    }
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
  if (
    baseline?.schemaVersion !== 1 ||
    !baseline.totals ||
    typeof baseline.totals !== "object"
  ) {
    throw new Error("Invalid baseline: expected a web-bundle-size schemaVersion 1 snapshot");
  }
  const comparison = {};
  for (const category of categories) {
    const previous = baseline.totals[category];
    const now = current.totals[category];
    if (
      !previous ||
      ![previous.bytes, previous.gzipBytes].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      )
    ) {
      throw new Error(`Invalid baseline totals for ${category}`);
    }
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
