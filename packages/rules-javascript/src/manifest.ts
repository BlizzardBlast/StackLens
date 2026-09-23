export const PACKAGE_DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export type PackageDependencyGroup = (typeof PACKAGE_DEPENDENCY_GROUPS)[number];

export interface NormalizedDependencyDeclaration {
  readonly name: string;
  readonly declaredSpecifier: string;
  readonly group: PackageDependencyGroup;
}

export interface NormalizedPackageManifest {
  readonly packageName?: string;
  readonly packageManager?: string;
  readonly dependencies: readonly NormalizedDependencyDeclaration[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackageName(manifest: UnknownRecord): string | undefined {
  const packageName = manifest.name;

  if (packageName === undefined) {
    return undefined;
  }

  if (
    typeof packageName !== "string" ||
    packageName.trim().length === 0 ||
    packageName !== packageName.trim() ||
    packageName.length > 500
  ) {
    throw new TypeError(
      "package.json name must be a non-empty unpadded string of at most 500 characters when present",
    );
  }

  return packageName;
}

function readPackageManager(manifest: UnknownRecord): string | undefined {
  const packageManager = manifest.packageManager;

  if (packageManager === undefined) {
    return undefined;
  }

  if (
    typeof packageManager !== "string" ||
    packageManager.trim().length === 0 ||
    packageManager !== packageManager.trim() ||
    packageManager.length > 500
  ) {
    throw new TypeError(
      "package.json packageManager must be a non-empty unpadded string of at most 500 characters when present",
    );
  }

  return packageManager;
}

function readDependencyGroup(
  manifest: UnknownRecord,
  group: PackageDependencyGroup,
): NormalizedDependencyDeclaration[] {
  const value = manifest[group];

  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    throw new TypeError(`package.json ${group} must be an object when present`);
  }

  return Object.keys(value)
    .toSorted()
    .map((name) => {
      const declaredSpecifier = value[name];

      if (name.trim().length === 0 || name !== name.trim() || name.length > 500) {
        throw new TypeError(`package.json ${group} contains an invalid dependency name`);
      }

      if (
        typeof declaredSpecifier !== "string" ||
        declaredSpecifier.length === 0 ||
        declaredSpecifier.length > 2000
      ) {
        throw new TypeError(
          `package.json ${group}.${name} must be a non-empty string dependency specifier of at most 2000 characters`,
        );
      }

      return {
        name,
        declaredSpecifier,
        group,
      };
    });
}

export function normalizePackageManifest(input: unknown): NormalizedPackageManifest {
  if (!isRecord(input)) {
    throw new TypeError("package.json must be a JSON object");
  }

  const packageName = readPackageName(input);
  const packageManager = readPackageManager(input);
  const dependencies = PACKAGE_DEPENDENCY_GROUPS.flatMap((group) =>
    readDependencyGroup(input, group),
  );

  return {
    ...(packageName === undefined ? {} : { packageName }),
    ...(packageManager === undefined ? {} : { packageManager }),
    dependencies,
  };
}
