import type { JavaScriptResolvedDependencySnapshot } from "./lockfile.js";
import type { NormalizedPackageManifest } from "./manifest.js";
import type { JavaScriptSourceUsageSnapshot } from "./source-usage.js";

export interface JavaScriptStaticProjectFile {
  readonly path: string;
  readonly content: string;
}

export interface JavaScriptPackageScript {
  readonly name: string;
  readonly command: string;
}

export interface JavaScriptProjectSnapshot extends NormalizedPackageManifest {
  readonly repositoryCoverage?: JavaScriptRepositoryCoverage;
  readonly files?: readonly JavaScriptStaticProjectFile[];
  readonly scripts?: readonly JavaScriptPackageScript[];
  readonly sourceUsage?: JavaScriptSourceUsageSnapshot;
  readonly resolvedDependencies?: JavaScriptResolvedDependencySnapshot;
}

export interface JavaScriptProjectSnapshotOptions {
  readonly repositoryCoverage?: JavaScriptRepositoryCoverage;
  readonly scripts?: readonly JavaScriptPackageScript[];
  readonly sourceUsage?: JavaScriptSourceUsageSnapshot;
  readonly resolvedDependencies?: JavaScriptResolvedDependencySnapshot;
}

export interface JavaScriptRepositoryCoverage {
  readonly complete: boolean;
  readonly candidateSourceFiles: number;
  readonly acquiredSourceFiles: number;
  readonly lockfilePaths: readonly string[];
  readonly lockfileIssueCount: number;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

function validateProjectPath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 1_000 ||
    path.startsWith("/") ||
    path.includes("\\") ||
    containsControlCharacter(path)
  ) {
    throw new TypeError(
      "Static project file paths must be non-empty relative POSIX paths of at most 1000 characters.",
    );
  }

  const segments = path.split("/");

  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new TypeError("Static project file paths must use canonical relative path segments.");
  }
}

function validatePackageScript(script: JavaScriptPackageScript): JavaScriptPackageScript {
  if (
    script.name.length === 0 ||
    script.name.length > 500 ||
    script.name !== script.name.trim() ||
    containsControlCharacter(script.name)
  ) {
    throw new TypeError(
      "package.json script names must be non-empty unpadded strings of at most 500 characters.",
    );
  }

  if (script.command.length === 0 || script.command.length > 10_000) {
    throw new TypeError(
      "package.json script commands must be non-empty strings of at most 10000 characters.",
    );
  }

  return {
    name: script.name,
    command: script.command,
  };
}

export function normalizePackageScripts(input: unknown): JavaScriptPackageScript[] {
  if (!isRecord(input)) {
    return [];
  }

  const scripts = input.scripts;

  if (scripts === undefined) {
    return [];
  }

  if (!isRecord(scripts)) {
    throw new TypeError(
      "package.json scripts must be an object when source-usage analysis reads them.",
    );
  }

  return Object.entries(scripts)
    .map(([name, command]) => {
      if (typeof command !== "string") {
        throw new TypeError(
          "package.json scripts." + name + " must be a string when source-usage analysis reads it.",
        );
      }

      return validatePackageScript({ name, command });
    })
    .toSorted((left, right) => compareCodeUnits(left.name, right.name));
}

export function createJavaScriptProjectSnapshot(
  manifest: NormalizedPackageManifest,
  files: readonly JavaScriptStaticProjectFile[],
  options: JavaScriptProjectSnapshotOptions = {},
): JavaScriptProjectSnapshot {
  const seenPaths = new Set<string>();
  const normalizedFiles = files
    .map((file) => {
      validateProjectPath(file.path);

      if (typeof file.content !== "string") {
        throw new TypeError("Static project file " + file.path + " content must be a string.");
      }

      if (seenPaths.has(file.path)) {
        throw new TypeError("Static project file path " + file.path + " is duplicated.");
      }

      seenPaths.add(file.path);

      return {
        path: file.path,
        content: file.content,
      };
    })
    .toSorted((left, right) => compareCodeUnits(left.path, right.path));

  const normalizedScripts = (options.scripts ?? [])
    .map(validatePackageScript)
    .toSorted((left, right) => compareCodeUnits(left.name, right.name));

  return {
    ...(manifest.packageName === undefined ? {} : { packageName: manifest.packageName }),
    ...(manifest.packageManager === undefined ? {} : { packageManager: manifest.packageManager }),
    dependencies: manifest.dependencies.map((dependency) => ({ ...dependency })),
    ...(options.repositoryCoverage === undefined
      ? {}
      : { repositoryCoverage: options.repositoryCoverage }),
    files: normalizedFiles,
    ...(normalizedScripts.length === 0 ? {} : { scripts: normalizedScripts }),
    ...(options.sourceUsage === undefined ? {} : { sourceUsage: options.sourceUsage }),
    ...(options.resolvedDependencies === undefined
      ? {}
      : { resolvedDependencies: options.resolvedDependencies }),
  };
}
