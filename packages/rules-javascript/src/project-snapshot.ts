import type { NormalizedPackageManifest } from "./manifest.js";

export interface JavaScriptStaticProjectFile {
  readonly path: string;
  readonly content: string;
}

export interface JavaScriptProjectSnapshot extends NormalizedPackageManifest {
  readonly files?: readonly JavaScriptStaticProjectFile[];
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

export function createJavaScriptProjectSnapshot(
  manifest: NormalizedPackageManifest,
  files: readonly JavaScriptStaticProjectFile[],
): JavaScriptProjectSnapshot {
  const seenPaths = new Set<string>();
  const normalizedFiles = files
    .map((file) => {
      validateProjectPath(file.path);

      if (typeof file.content !== "string") {
        throw new TypeError(`Static project file ${file.path} content must be a string.`);
      }

      if (seenPaths.has(file.path)) {
        throw new TypeError(`Static project file path ${file.path} is duplicated.`);
      }

      seenPaths.add(file.path);

      return {
        path: file.path,
        content: file.content,
      };
    })
    .toSorted((left, right) => compareCodeUnits(left.path, right.path));

  return {
    ...(manifest.packageName === undefined ? {} : { packageName: manifest.packageName }),
    dependencies: manifest.dependencies.map((dependency) => ({ ...dependency })),
    files: normalizedFiles,
  };
}
