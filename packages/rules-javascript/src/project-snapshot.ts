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
  readonly files?: readonly JavaScriptStaticProjectFile[];
  readonly scripts?: readonly JavaScriptPackageScript[];
  readonly sourceUsage?: JavaScriptSourceUsageSnapshot;
}

export interface JavaScriptProjectSnapshotOptions {
  readonly scripts?: readonly JavaScriptPackageScript[];
  readonly sourceUsage?: JavaScriptSourceUsageSnapshot;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return [];
  }

  const scripts = (input as Record<string, unknown>).scripts;

  if (scripts === undefined) {
    return [];
  }

  if (typeof scripts !== "object" || scripts === null || Array.isArray(scripts)) {
    return [];
  }

  return Object.entries(scripts)
    .flatMap(([name, command]) =>
      typeof command === "string" ? [validatePackageScript({ name, command })] : [],
    )
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
    dependencies: manifest.dependencies.map((dependency) => ({ ...dependency })),
    files: normalizedFiles,
    ...(normalizedScripts.length === 0 ? {} : { scripts: normalizedScripts }),
    ...(options.sourceUsage === undefined ? {} : { sourceUsage: options.sourceUsage }),
  };
}
