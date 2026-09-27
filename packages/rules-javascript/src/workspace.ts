import { minimatch } from "minimatch";

import { normalizeResolvedDependencies, isSupportedLockfilePath } from "./lockfile.js";
import { normalizePackageManifest } from "./manifest.js";
import type { NormalizedDependencyDeclaration } from "./manifest.js";
import { createJavaScriptProjectSnapshot, normalizePackageScripts } from "./project-snapshot.js";
import type {
  JavaScriptProjectSnapshot,
  JavaScriptRepositoryCoverage,
  JavaScriptStaticProjectFile,
} from "./project-snapshot.js";
import { canonicalPath, isRecord, parseStaticYaml, localPath } from "./static-data.js";

export function workspacePackages(
  project: JavaScriptProjectSnapshot,
): readonly JavaScriptProjectSnapshot[] {
  return project.workspacePackages ?? [project];
}

export function externalDeclarations(
  project: JavaScriptProjectSnapshot,
): readonly NormalizedDependencyDeclaration[] {
  return project.dependencies.filter(
    (item) =>
      !item.peerOnly &&
      item.internalPackagePath === undefined &&
      !(item.effectiveSpecifier ?? item.declaredSpecifier).startsWith("workspace:"),
  );
}

export function createWorkspaceProject(
  rootContent: string,
  files: readonly JavaScriptStaticProjectFile[],
  coverage: JavaScriptRepositoryCoverage,
  manifestPaths: readonly string[] = files
    .filter((file) => file.path.endsWith("/package.json"))
    .map((file) => file.path),
): JavaScriptProjectSnapshot {
  const root: unknown = JSON.parse(rootContent);
  const rootManifest = normalizePackageManifest(root);
  const issues: { code: string; path: string; message: string }[] = [];
  let patterns: string[] = [];
  let configuration: Record<string, unknown> = {};
  const workspaceFile = files.find((file) => file.path === "pnpm-workspace.yaml");
  try {
    if (workspaceFile !== undefined) {
      const parsed = parseStaticYaml(workspaceFile.content);
      if (!isRecord(parsed)) throw new TypeError("Invalid workspace configuration");
      configuration = parsed;
    }
    const declared =
      workspaceFile !== undefined
        ? configuration.packages
        : isRecord(root)
          ? root.workspaces
          : undefined;
    const values = isRecord(declared) ? declared.packages : declared;
    if (values !== undefined) {
      if (
        !Array.isArray(values) ||
        values.length > 256 ||
        values.some(
          (item) =>
            typeof item !== "string" ||
            item.length > 1000 ||
            item.startsWith("/") ||
            item.includes("\\") ||
            item.split("/").includes(".."),
        )
      )
        throw new TypeError("Unsupported workspace patterns");
      patterns = values.filter((value): value is string => typeof value === "string");
    }
  } catch {
    issues.push({
      code: "workspace_configuration_invalid",
      path: workspaceFile?.path ?? "package.json",
      message: "Workspace declarations could not be inspected completely.",
    });
  }
  const selected = [...new Set(manifestPaths)]
    .filter((path) => {
      if (!canonicalPath(path) || !path.endsWith("/package.json")) return false;
      const directory = path.slice(0, -13);
      return (
        patterns.some(
          (pattern) => !pattern.startsWith("!") && minimatch(directory, pattern, { dot: true }),
        ) &&
        !patterns.some(
          (pattern) =>
            pattern.startsWith("!") && minimatch(directory, pattern.slice(1), { dot: true }),
        )
      );
    })
    .toSorted();
  const manifests = [{ path: ".", raw: root, manifest: rootManifest }];
  for (const path of selected) {
    try {
      const file = files.find((item) => item.path === path);
      if (file === undefined) throw new TypeError("Missing workspace manifest");
      const raw: unknown = JSON.parse(file.content);
      const manifest = normalizePackageManifest(raw);
      normalizePackageScripts(raw);
      manifests.push({ path: path.slice(0, -13), raw, manifest });
    } catch {
      issues.push({
        code: "workspace_manifest_unavailable",
        path,
        message: `Workspace manifest ${path} is missing or malformed; its dependencies and setup are unknown.`,
      });
    }
  }
  const declarations = (
    raw: readonly NormalizedDependencyDeclaration[],
    path: string,
  ): NormalizedDependencyDeclaration[] =>
    raw.map((declaration) => {
      let effectiveSpecifier = declaration.declaredSpecifier;
      let catalog: string | undefined;
      if (effectiveSpecifier.startsWith("catalog:")) {
        catalog = effectiveSpecifier.slice(8) || "default";
        const values =
          catalog === "default"
            ? configuration.catalog
            : isRecord(configuration.catalogs)
              ? configuration.catalogs[catalog]
              : undefined;
        const value =
          isRecord(values) && Object.hasOwn(values, declaration.name)
            ? values[declaration.name]
            : undefined;
        if (
          typeof value === "string" &&
          value.length > 0 &&
          value.length <= 2000 &&
          !value.startsWith("catalog:")
        )
          effectiveSpecifier = value;
      }
      const internal = effectiveSpecifier.startsWith("workspace:")
        ? manifests.filter((item) => item.manifest.packageName === declaration.name)
        : [];
      const internalPackagePath = internal.length === 1 ? internal[0]!.path : undefined;
      if (
        effectiveSpecifier.startsWith("catalog:") ||
        (effectiveSpecifier.startsWith("workspace:") && internalPackagePath === undefined)
      ) {
        issues.push({
          code: "workspace_dependency_unresolved",
          path: path === "." ? "package.json" : path + "/package.json",
          message: `The ${declaration.group} declaration for ${declaration.name} has an unresolved catalog or internal workspace target.`,
        });
      }
      return {
        ...declaration,
        effectiveSpecifier,
        ...(catalog === undefined ? {} : { catalog }),
        ...(internalPackagePath === undefined ? {} : { internalPackagePath }),
        peerOnly: declaration.group === "peerDependencies",
      };
    });
  const packages = manifests.map(({ path, raw, manifest }) => {
    const dependencies = declarations(manifest.dependencies, path);
    const normalized = {
      ...manifest,
      packagePath: path,
      dependencies,
      ...(manifest.packageManager === undefined && rootManifest.packageManager !== undefined
        ? { packageManager: rootManifest.packageManager }
        : {}),
    };
    const ownedFiles = files
      .filter((file) => {
        if (file.path.endsWith("/package.json") || isSupportedLockfilePath(file.path)) return false;
        const owner =
          selected
            .map((item) => item.slice(0, -13))
            .filter((directory) => file.path.startsWith(directory + "/"))
            .toSorted((a, b) => b.length - a.length)[0] ?? ".";
        return owner === path;
      })
      .map((file) => ({
        ...file,
        path: path === "." ? file.path : file.path.slice(path.length + 1),
      }));
    const resolution = normalizeResolvedDependencies(normalized, files);
    for (const dependency of dependencies.filter(
      (item) => item.internalPackagePath !== undefined && !item.peerOnly,
    )) {
      let matched = false;
      const pnpm = files.find((file) => file.path === "pnpm-lock.yaml");
      if (pnpm !== undefined)
        try {
          const lock = parseStaticYaml(pnpm.content);
          const importer =
            isRecord(lock) && isRecord(lock.importers) ? lock.importers[path] : undefined;
          const group = isRecord(importer) ? importer[dependency.group] : undefined;
          const entry = isRecord(group) ? group[dependency.name] : undefined;
          matched =
            isRecord(entry) &&
            entry.specifier === dependency.declaredSpecifier &&
            typeof entry.version === "string" &&
            entry.version.startsWith("link:") &&
            localPath(
              path === "." ? "package.json" : path + "/package.json",
              entry.version.slice(5),
            ) === dependency.internalPackagePath;
        } catch {
          /* Lockfile diagnostics are also retained by the resolver. */
        }
      if (!matched && coverage.lockfilePaths.length > 0)
        issues.push({
          code: "lockfile_internal_target_unresolved",
          path: path === "." ? "package.json" : path + "/package.json",
          message:
            "Internal workspace lockfile target for " +
            dependency.name +
            " is missing, stale, or outside supported link resolution.",
        });
    }
    const ownSource = ownedFiles.some(
      (file) =>
        /\.[cm]?[jt]sx?$|\.mdx$/u.test(file.path) &&
        !/(^|\/)(scripts|\.storybook)\//u.test(file.path) &&
        !/(?:^|\/)[^/]*config\.[^/]+$/u.test(file.path),
    );
    const role =
      path === "." && manifests.length > 1 && !ownSource
        ? ("orchestrator" as const)
        : ("package" as const);
    const packageIssues = resolution.issues.map((item) => ({
      code: item.code,
      path: path === "." ? "package.json" : path + "/package.json",
      message: item.message,
    }));
    issues.push(...packageIssues);
    return {
      ...createJavaScriptProjectSnapshot(normalized, ownedFiles, {
        scripts: normalizePackageScripts(raw),
        repositoryCoverage: { ...coverage, lockfileIssueCount: resolution.issues.length },
        ...(resolution.snapshot === undefined ? {} : { resolvedDependencies: resolution.snapshot }),
      }),
      role,
      repositoryFiles: files,
      ...(isRecord(raw) && raw.jest !== undefined ? { jestConfiguration: raw.jest } : {}),
    };
  });
  return { ...packages[0]!, workspacePackages: packages, workspaceIssues: issues };
}
