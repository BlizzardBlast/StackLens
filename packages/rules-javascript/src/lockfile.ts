import type { FactRule } from "@stacklens/analyzer-core";
import type { AnalysisFact, ProjectEvidence } from "@stacklens/contracts";

import type {
  NormalizedDependencyDeclaration,
  NormalizedPackageManifest,
  PackageDependencyGroup,
} from "./manifest.js";
import { parseExactSemanticVersion } from "./semver.js";
import { stableHash } from "./stable-id.js";
import { parseStaticYaml } from "./static-data.js";

export const SUPPORTED_LOCKFILE_PATHS = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
] as const;

export type SupportedLockfilePath = (typeof SUPPORTED_LOCKFILE_PATHS)[number];
export type JavaScriptPackageManager = "npm" | "pnpm" | "yarn";

export interface JavaScriptResolvedDependency {
  readonly packageName: string;
  readonly declaredSpecifier: string;
  readonly version: string;
  readonly effectiveSpecifier?: string;
  readonly dependencyGroup?: PackageDependencyGroup;
  readonly packagePath?: string;
  readonly catalog?: string;
}

export type ResolvedDependencyIssueCode =
  | "lockfile_invalid"
  | "lockfile_multiple"
  | "lockfile_package_manager_mismatch"
  | "lockfile_resolution_missing"
  | "lockfile_resolution_non_semver"
  | "lockfile_specifier_mismatch";

export interface JavaScriptResolvedDependencyIssue {
  readonly code: ResolvedDependencyIssueCode;
  readonly packageName?: string;
  readonly declaredSpecifier?: string;
  readonly message: string;
}

export interface JavaScriptResolvedDependencySnapshot {
  readonly path: SupportedLockfilePath;
  readonly packagePath?: string;
  readonly packageManager: JavaScriptPackageManager;
  readonly resolutions: readonly JavaScriptResolvedDependency[];
  readonly issues: readonly JavaScriptResolvedDependencyIssue[];
}

export interface JavaScriptLockfileFile {
  readonly path: string;
  readonly content: string;
}

export interface ResolvedDependencyNormalization {
  readonly snapshot?: JavaScriptResolvedDependencySnapshot;
  readonly issues: readonly JavaScriptResolvedDependencyIssue[];
}

interface CandidateResolution {
  readonly packageName: string;
  readonly declaredSpecifier: string;
  readonly version: string | undefined;
  readonly specifierMatches: boolean;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueDeclarations(
  manifest: NormalizedPackageManifest,
): readonly NormalizedDependencyDeclaration[] {
  const unique = new Map<string, NormalizedDependencyDeclaration>();

  for (const declaration of manifest.dependencies.filter(
    (item) => !item.peerOnly && item.internalPackagePath === undefined,
  )) {
    unique.set(
      JSON.stringify([declaration.name, declaration.declaredSpecifier, declaration.group]),
      declaration,
    );
  }

  return [...unique.values()].toSorted((left, right) => {
    const nameOrder = compareCodeUnits(left.name, right.name);

    if (nameOrder !== 0) {
      return nameOrder;
    }

    const specifierOrder = compareCodeUnits(left.declaredSpecifier, right.declaredSpecifier);
    return specifierOrder === 0 ? compareCodeUnits(left.group, right.group) : specifierOrder;
  });
}

function packageManagerFromManifest(
  packageManager: string | undefined,
): JavaScriptPackageManager | undefined {
  if (packageManager === undefined) {
    return undefined;
  }

  if (packageManager.startsWith("npm@")) {
    return "npm";
  }

  if (packageManager.startsWith("pnpm@")) {
    return "pnpm";
  }

  if (packageManager.startsWith("yarn@")) {
    return "yarn";
  }

  return undefined;
}

function lockfilePackageManager(path: SupportedLockfilePath): JavaScriptPackageManager {
  if (path === "package-lock.json") {
    return "npm";
  }

  return path === "pnpm-lock.yaml" ? "pnpm" : "yarn";
}

export function isSupportedLockfilePath(path: string): path is SupportedLockfilePath {
  return (SUPPORTED_LOCKFILE_PATHS as readonly string[]).includes(path);
}

function issue(
  code: ResolvedDependencyIssueCode,
  message: string,
  declaration?: NormalizedDependencyDeclaration,
): JavaScriptResolvedDependencyIssue {
  return {
    code,
    message,
    ...(declaration === undefined
      ? {}
      : {
          packageName: declaration.name,
          declaredSpecifier: declaration.declaredSpecifier,
        }),
  };
}

function exactVersion(value: string | undefined): string | undefined {
  if (value === undefined || parseExactSemanticVersion(value) === undefined) {
    return undefined;
  }

  return value;
}

function uniqueResolutions(
  resolutions: readonly JavaScriptResolvedDependency[],
): readonly JavaScriptResolvedDependency[] {
  const unique = new Map<string, JavaScriptResolvedDependency>();

  for (const resolution of resolutions) {
    unique.set(
      JSON.stringify([
        resolution.packageName,
        resolution.declaredSpecifier,
        resolution.version,
        resolution.dependencyGroup,
      ]),
      resolution,
    );
  }

  return [...unique.values()].toSorted((left, right) => {
    const packageOrder = compareCodeUnits(left.packageName, right.packageName);

    if (packageOrder !== 0) {
      return packageOrder;
    }

    const specifierOrder = compareCodeUnits(left.declaredSpecifier, right.declaredSpecifier);
    return specifierOrder === 0 ? compareCodeUnits(left.version, right.version) : specifierOrder;
  });
}

function resolutionFromCandidate(
  declaration: NormalizedDependencyDeclaration,
  candidate: CandidateResolution | undefined,
  issues: JavaScriptResolvedDependencyIssue[],
): JavaScriptResolvedDependency | undefined {
  if (candidate === undefined) {
    issues.push(
      issue(
        "lockfile_resolution_missing",
        `Lockfile evidence does not contain a supported direct resolution for ${declaration.name} declared as ${JSON.stringify(declaration.declaredSpecifier)}.`,
        declaration,
      ),
    );
    return undefined;
  }

  if (!candidate.specifierMatches) {
    issues.push(
      issue(
        "lockfile_specifier_mismatch",
        `Lockfile declaration metadata for ${declaration.name} does not match package.json specifier ${JSON.stringify(declaration.declaredSpecifier)}; the lockfile may be stale.`,
        declaration,
      ),
    );
    return undefined;
  }

  const version = exactVersion(candidate.version);

  if (version === undefined) {
    issues.push(
      issue(
        "lockfile_resolution_non_semver",
        `Lockfile evidence for ${declaration.name} does not resolve to a supported exact semantic version.`,
        declaration,
      ),
    );
    return undefined;
  }

  return {
    packageName: declaration.name,
    declaredSpecifier: declaration.declaredSpecifier,
    version,
    ...(declaration.effectiveSpecifier === undefined ? {} : { dependencyGroup: declaration.group }),
    ...(declaration.effectiveSpecifier === undefined
      ? {}
      : { effectiveSpecifier: declaration.effectiveSpecifier }),
    ...(declaration.catalog === undefined ? {} : { catalog: declaration.catalog }),
  };
}

function packageLockCandidate(
  parsed: Record<string, unknown>,
  declaration: NormalizedDependencyDeclaration,
  packagePath = ".",
): CandidateResolution | undefined {
  const packages = parsed.packages;

  if (isRecord(packages)) {
    const root = packages[packagePath === "." ? "" : packagePath];
    let directory = packagePath === "." ? "" : packagePath;
    let installed: unknown;
    for (;;) {
      const key = (directory === "" ? "" : directory + "/") + "node_modules/" + declaration.name;
      if (Object.hasOwn(packages, key)) {
        installed = packages[key];
        break;
      }
      if (directory === "") break;
      directory = directory.includes("/") ? directory.slice(0, directory.lastIndexOf("/")) : "";
    }

    if (!isRecord(root) || !isRecord(installed)) {
      return undefined;
    }

    const group = root[declaration.group];

    if (!isRecord(group)) {
      return undefined;
    }

    const lockfileSpecifier = group[declaration.name];
    const version = installed.version;

    return {
      packageName: declaration.name,
      declaredSpecifier: declaration.declaredSpecifier,
      version: typeof version === "string" ? version : undefined,
      specifierMatches:
        typeof lockfileSpecifier === "string" &&
        lockfileSpecifier === declaration.declaredSpecifier,
    };
  }

  const dependencies = parsed.dependencies;
  const record = isRecord(dependencies) ? dependencies[declaration.name] : undefined;

  if (
    isRecord(record) &&
    declaration.declaredSpecifier === record.version &&
    typeof record.version === "string"
  ) {
    return {
      packageName: declaration.name,
      declaredSpecifier: declaration.declaredSpecifier,
      version: record.version,
      specifierMatches: true,
    };
  }

  return undefined;
}

function parsePackageLock(
  content: string,
  manifest: NormalizedPackageManifest,
): ResolvedDependencyNormalization {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      issues: [
        issue(
          "lockfile_invalid",
          "package-lock.json could not be parsed as strict JSON, so resolved dependency evidence is unavailable.",
        ),
      ],
    };
  }

  if (!isRecord(parsed)) {
    return {
      issues: [
        issue(
          "lockfile_invalid",
          "package-lock.json must contain an object root for resolved dependency analysis.",
        ),
      ],
    };
  }

  const issues: JavaScriptResolvedDependencyIssue[] = [];
  const resolutions = uniqueDeclarations(manifest).flatMap((declaration) => {
    const resolution = resolutionFromCandidate(
      declaration,
      packageLockCandidate(parsed, declaration, manifest.packagePath),
      issues,
    );

    return resolution === undefined ? [] : [resolution];
  });

  return {
    snapshot: {
      path: "package-lock.json",
      packageManager: "npm",
      ...(manifest.packagePath === undefined ? {} : { packagePath: manifest.packagePath }),
      resolutions: uniqueResolutions(resolutions),
      issues,
    },
    issues,
  };
}

function yamlScalar(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed : trimmed.slice(1, -1);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  return trimmed;
}

function pnpmVersion(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)(?:\(|$)/u.exec(value);

  return match?.[1];
}

function parsePnpmLock(
  content: string,
  manifest: NormalizedPackageManifest,
): ResolvedDependencyNormalization {
  let parsed: unknown;
  try {
    parsed = parseStaticYaml(content);
  } catch {
    return {
      issues: [issue("lockfile_invalid", "pnpm-lock.yaml is malformed or uses unsupported YAML.")],
    };
  }
  if (!isRecord(parsed))
    return { issues: [issue("lockfile_invalid", "pnpm-lock.yaml requires an object root.")] };
  const importerPath = manifest.packagePath ?? ".";
  const importer = isRecord(parsed.importers)
    ? parsed.importers[importerPath]
    : importerPath === "."
      ? parsed
      : undefined;
  const issues: JavaScriptResolvedDependencyIssue[] = [];
  const resolutions = uniqueDeclarations(manifest).flatMap((declaration) => {
    const group = isRecord(importer) ? importer[declaration.group] : undefined;
    const value = isRecord(group) ? group[declaration.name] : undefined;
    const entry = isRecord(value) ? value : undefined;
    const effective = declaration.effectiveSpecifier ?? declaration.declaredSpecifier;
    let catalogMatches = true;
    if (declaration.catalog !== undefined) {
      const catalog = isRecord(parsed.catalogs) ? parsed.catalogs[declaration.catalog] : undefined;
      const record = isRecord(catalog) ? catalog[declaration.name] : undefined;
      catalogMatches =
        isRecord(record) &&
        record.specifier === effective &&
        typeof record.version === "string" &&
        typeof entry?.version === "string" &&
        pnpmVersion(record.version) === pnpmVersion(entry.version) &&
        !effective.startsWith("catalog:");
    }
    const candidate =
      entry === undefined
        ? undefined
        : {
            packageName: declaration.name,
            declaredSpecifier: declaration.declaredSpecifier,
            version: pnpmVersion(typeof entry.version === "string" ? entry.version : undefined),
            specifierMatches:
              catalogMatches &&
              (entry.specifier === declaration.declaredSpecifier || entry.specifier === effective),
          };
    const resolution = resolutionFromCandidate(declaration, candidate, issues);
    return resolution === undefined ? [] : [resolution];
  });

  if (!isRecord(importer) && uniqueDeclarations(manifest).length > 0) {
    issues.unshift(
      issue(
        "lockfile_invalid",
        "pnpm-lock.yaml does not contain a supported matching importer dependency shape.",
      ),
    );
  }

  return {
    snapshot: {
      path: "pnpm-lock.yaml",
      packageManager: "pnpm",
      ...(manifest.packagePath === undefined ? {} : { packagePath: manifest.packagePath }),
      resolutions: uniqueResolutions(resolutions),
      issues,
    },
    issues,
  };
}

function yarnSelectors(header: string): readonly string[] {
  const trimmed = header.trim().replace(/:$/u, "");
  const quoted: string[] = [];
  const pattern = /"((?:\\.|[^"\\])*)"/gu;
  let match = pattern.exec(trimmed);

  while (match !== null) {
    try {
      const parsed: unknown = JSON.parse(`"${match[1] ?? ""}"`);
      quoted.push(typeof parsed === "string" ? parsed : (match[1] ?? ""));
    } catch {
      quoted.push(match[1] ?? "");
    }

    match = pattern.exec(trimmed);
  }

  if (quoted.length > 0) {
    return quoted;
  }

  return trimmed
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);
}

function parseYarnVersions(content: string): ReadonlyMap<string, string> {
  const versions = new Map<string, string>();
  let selectors: readonly string[] = [];

  for (const line of content.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) {
      continue;
    }

    if (!line.startsWith(" ") && line.trimEnd().endsWith(":")) {
      selectors = yarnSelectors(line);
      continue;
    }

    if (selectors.length === 0) {
      continue;
    }

    const trimmed = line.trim();
    let version: string | undefined;

    if (trimmed.startsWith("version:")) {
      version = yamlScalar(trimmed.slice("version:".length));
    } else if (trimmed.startsWith("version ")) {
      version = yamlScalar(trimmed.slice("version ".length));
    }

    if (version === undefined) {
      continue;
    }

    for (const selector of selectors) {
      versions.set(selector, version);
    }
  }

  return versions;
}

function parseYarnLock(
  content: string,
  manifest: NormalizedPackageManifest,
): ResolvedDependencyNormalization {
  const versions = parseYarnVersions(content);
  const issues: JavaScriptResolvedDependencyIssue[] = [];
  const resolutions = uniqueDeclarations(manifest).flatMap((declaration) => {
    const classicSelector = `${declaration.name}@${declaration.declaredSpecifier}`;
    const berrySelector = `${declaration.name}@npm:${declaration.declaredSpecifier}`;
    const version = versions.get(berrySelector) ?? versions.get(classicSelector);
    const candidate =
      version === undefined
        ? undefined
        : {
            packageName: declaration.name,
            declaredSpecifier: declaration.declaredSpecifier,
            version,
            specifierMatches: true,
          };
    const resolution = resolutionFromCandidate(declaration, candidate, issues);
    return resolution === undefined ? [] : [resolution];
  });

  if (versions.size === 0 && manifest.dependencies.length > 0) {
    issues.unshift(
      issue(
        "lockfile_invalid",
        "yarn.lock does not contain supported dependency resolution records.",
      ),
    );
  }

  return {
    snapshot: {
      path: "yarn.lock",
      packageManager: "yarn",
      ...(manifest.packagePath === undefined ? {} : { packagePath: manifest.packagePath }),
      resolutions: uniqueResolutions(resolutions),
      issues,
    },
    issues,
  };
}

export function normalizeResolvedDependencies(
  manifest: NormalizedPackageManifest,
  files: readonly JavaScriptLockfileFile[],
): ResolvedDependencyNormalization {
  const lockfiles = files
    .filter((file): file is JavaScriptLockfileFile & { readonly path: SupportedLockfilePath } =>
      isSupportedLockfilePath(file.path),
    )
    .toSorted((left, right) => compareCodeUnits(left.path, right.path));

  if (lockfiles.length === 0) {
    return { issues: [] };
  }

  const managerHint = packageManagerFromManifest(manifest.packageManager);
  let selected = lockfiles[0];

  if (lockfiles.length > 1) {
    if (managerHint === undefined) {
      return {
        issues: [
          issue(
            "lockfile_multiple",
            "Multiple supported root lockfiles are present without a recognized packageManager hint, so StackLens does not guess which lockfile is authoritative.",
          ),
        ],
      };
    }

    selected = lockfiles.find((file) => lockfilePackageManager(file.path) === managerHint);

    if (selected === undefined) {
      return {
        issues: [
          issue(
            "lockfile_package_manager_mismatch",
            `package.json declares package manager ${managerHint}, but no matching supported root lockfile is available.`,
          ),
        ],
      };
    }
  } else if (
    managerHint !== undefined &&
    selected !== undefined &&
    lockfilePackageManager(selected.path) !== managerHint
  ) {
    return {
      issues: [
        issue(
          "lockfile_package_manager_mismatch",
          `package.json declares package manager ${managerHint}, but the available lockfile is ${selected.path}.`,
        ),
      ],
    };
  }

  if (selected === undefined) {
    return { issues: [] };
  }

  if (selected.path === "package-lock.json") {
    return parsePackageLock(selected.content, manifest);
  }

  if (selected.path === "pnpm-lock.yaml") {
    return parsePnpmLock(selected.content, manifest);
  }

  return parseYarnLock(selected.content, manifest);
}

function resolutionIdentity(
  snapshot: JavaScriptResolvedDependencySnapshot,
  resolution: JavaScriptResolvedDependency,
): string {
  return JSON.stringify([
    snapshot.path,
    snapshot.packagePath ?? ".",
    resolution.packageName,
    resolution.declaredSpecifier,
    resolution.version,
    resolution.dependencyGroup ?? "",
  ]);
}

export function resolvedDependencyEvidenceId(
  snapshot: JavaScriptResolvedDependencySnapshot,
  resolution: JavaScriptResolvedDependency,
): string {
  return `evidence-js-resolved-${stableHash(resolutionIdentity(snapshot, resolution))}`;
}

export function resolvedDependencyFactId(
  snapshot: JavaScriptResolvedDependencySnapshot,
  resolution: JavaScriptResolvedDependency,
): string {
  return `fact-js-resolved-${stableHash(resolutionIdentity(snapshot, resolution))}`;
}

export function createResolvedDependencyEvidence(
  snapshot: JavaScriptResolvedDependencySnapshot,
): ProjectEvidence[] {
  return snapshot.resolutions.map((resolution) => ({
    id: resolvedDependencyEvidenceId(snapshot, resolution),
    kind: "project",
    summary: `${snapshot.path} resolves ${resolution.packageName} declared as ${JSON.stringify(resolution.declaredSpecifier)} to exact version ${resolution.version}.`,
    location: {
      path: snapshot.path,
    },
  }));
}

export function resolvedDependency(
  snapshot: JavaScriptResolvedDependencySnapshot | undefined,
  packageName: string,
  declaredSpecifier: string,
): JavaScriptResolvedDependency | undefined {
  const matches =
    snapshot?.resolutions.filter(
      (resolution) =>
        resolution.packageName === packageName &&
        resolution.declaredSpecifier === declaredSpecifier,
    ) ?? [];
  return new Set(matches.map((resolution) => resolution.version)).size === 1
    ? matches[0]
    : undefined;
}

export const resolvedDependencyFactRule: FactRule<
  NormalizedPackageManifest & {
    readonly resolvedDependencies?: JavaScriptResolvedDependencySnapshot;
  },
  unknown
> = {
  kind: "fact",
  id: "JS-RESOLVED-023",
  version: "2",
  requirementIds: ["FR-023", "FR-017", "NFR-001"],
  evaluate(context) {
    const snapshot = context.project.resolvedDependencies;

    if (snapshot === undefined) {
      return {};
    }

    const facts: AnalysisFact[] = snapshot.resolutions.map((resolution) => ({
      id: resolvedDependencyFactId(snapshot, resolution),
      type: "dependency.resolution",
      ...(snapshot.packagePath === undefined
        ? {}
        : {
            details: {
              kind: "dependency_resolution" as const,
              packagePath: snapshot.packagePath,
              dependencyGroup: resolution.dependencyGroup ?? "dependencies",
              declaredSpecifier: resolution.declaredSpecifier,
              effectiveSpecifier: resolution.effectiveSpecifier ?? resolution.declaredSpecifier,
              version: resolution.version,
              lockfilePath: snapshot.path,
              ...(resolution.catalog === undefined ? {} : { catalog: resolution.catalog }),
            },
          }),
      subject: {
        type: "dependency",
        name: resolution.packageName,
        path: snapshot.path,
      },
      statement: `${snapshot.path} resolves ${resolution.packageName} declared as ${JSON.stringify(resolution.declaredSpecifier)} to exact version ${resolution.version}.`,
      rule: {
        id: "JS-RESOLVED-023",
        version: "2",
      },
      requirementIds: ["FR-023"],
      evidenceIds: [resolvedDependencyEvidenceId(snapshot, resolution)],
    }));

    return { facts };
  },
};
