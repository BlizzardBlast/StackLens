const IGNORED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  "bower_components",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
]);

const CONFIG_PREFIXES = [
  "eslint.config.",
  "jest.config.",
  "next.config.",
  "prettier.config.",
  "rollup.config.",
  "tailwind.config.",
  "vite.config.",
  "vitest.config.",
  "webpack.config.",
] as const;

const SUPPORTED_LOCKFILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

const SOURCE_EXTENSIONS = [".js", ".jsx", ".cjs", ".mjs", ".ts", ".tsx", ".cts", ".mts"] as const;
const UNSUPPORTED_SOURCE_USAGE_EXTENSIONS = [".astro", ".mdx", ".svelte", ".vue"] as const;

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function isSupportedJavaScriptSourcePath(path: string): boolean {
  const name = baseName(path).toLowerCase();
  return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function isUnsupportedSourceUsagePath(path: string): boolean {
  const name = baseName(path).toLowerCase();
  return UNSUPPORTED_SOURCE_USAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function isCanonicalRepositoryPath(path: string): boolean {
  if (path.length === 0 || path.length > 1_000 || path.startsWith("/") || path.includes("\\")) {
    return false;
  }

  for (let index = 0; index < path.length; index += 1) {
    const code = path.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return false;
    }
  }

  const segments = path.split("/");
  return !segments.some((segment) => segment.length === 0 || segment === "." || segment === "..");
}

export function isIgnoredRepositoryPath(path: string): boolean {
  const segments = path.split("/");
  return segments.slice(0, -1).some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

export function isSupportedDependencyLockfilePath(path: string): boolean {
  return SUPPORTED_LOCKFILES.has(path);
}

export function isInitialSupportedSnapshotPath(path: string): boolean {
  if (
    path === "package.json" ||
    isSupportedDependencyLockfilePath(path) ||
    isSupportedJavaScriptSourcePath(path)
  ) {
    return true;
  }

  const name = baseName(path);

  if (
    name === "tsconfig.json" ||
    /^tsconfig\.[^.]+\.json$/.test(name) ||
    name === ".eslintrc.json" ||
    name.startsWith(".eslintrc.") ||
    name === ".prettierrc" ||
    name === ".prettierrc.json" ||
    name.startsWith(".prettierrc.") ||
    name === "biome.json" ||
    name === "biome.jsonc"
  ) {
    return true;
  }

  return CONFIG_PREFIXES.some((prefix) => name.startsWith(prefix));
}
