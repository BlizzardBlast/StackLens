import { describe, expect, it } from "vitest";

import { dependencyInventoryRule } from "../src/dependency-inventory.js";
import { normalizeResolvedDependencies } from "../src/lockfile.js";
import { resolvedDependencyFactRule } from "../src/lockfile.js";
import { normalizePackageManifest } from "../src/manifest.js";
import { projectConfigurationRule } from "../src/project-configuration.js";
import { createWorkspaceEvidence, scopeFactRule } from "../src/workspace-rules.js";
import {
  createWorkspaceProject,
  externalDeclarations,
  workspacePackages,
} from "../src/workspace.js";

const coverage = {
  complete: true,
  candidateSourceFiles: 2,
  acquiredSourceFiles: 2,
  lockfilePaths: ["pnpm-lock.yaml"],
  lockfileIssueCount: 0,
};
const root = JSON.stringify({ private: true, packageManager: "pnpm@11.20.0" });
const files = [
  {
    path: "pnpm-workspace.yaml",
    content:
      "packages: ['apps/*', 'packages/*', '!apps/excluded']\ncatalog:\n  react: ^19.0.0\ncatalogs:\n  tools:\n    typescript: ^6.0.0\n",
  },
  {
    path: "apps/web/package.json",
    content: JSON.stringify({
      name: "same-name",
      dependencies: { react: "catalog:", ui: "workspace:*" },
      devDependencies: { typescript: "catalog:tools" },
      peerDependencies: { vue: "^3" },
    }),
  },
  {
    path: "packages/ui/package.json",
    content: JSON.stringify({ name: "ui", dependencies: { react: "18.3.1" } }),
  },
  { path: "apps/excluded/package.json", content: "{}" },
  { path: "apps/web/src/main.tsx", content: "import React from 'react';" },
  { path: "packages/ui/src/main.tsx", content: "export const Ui = 1;" },
  {
    path: "pnpm-lock.yaml",
    content: `lockfileVersion: '9.0'
catalogs:
  default:
    react: {specifier: ^19.0.0, version: 19.2.3}
  tools:
    typescript: {specifier: ^6.0.0, version: 6.0.3}
importers:
  .: {}
  apps/web:
    dependencies:
      react: {specifier: 'catalog:', version: '19.2.3(react-dom@19.2.3)'}
      ui: {specifier: 'workspace:*', version: 'link:../../packages/ui'}
    devDependencies:
      typescript: {specifier: 'catalog:tools', version: 6.0.3}
  packages/ui:
    dependencies:
      react: {specifier: 18.3.1, version: 18.3.1}
`,
  },
];

describe("FR-005 FR-023 workspace snapshots", () => {
  it("preserves canonical file paths in scoped configuration limitations", () => {
    const project = createWorkspaceProject(
      root,
      [
        ...files,
        {
          path: "apps/web/vite.config.ts",
          content: "import opaque from 'preset'; export default opaque;",
        },
      ],
      coverage,
    );
    const result = scopeFactRule(projectConfigurationRule).evaluate({
      input: { type: "manifest", fingerprint: "fixture" },
      project,
      metadata: {},
      sources: [],
      evidence: createWorkspaceEvidence(project),
      limitations: [],
      partialFailures: [],
    });
    expect(result.limitations).toContainEqual(
      expect.objectContaining({
        packagePaths: ["apps/web"],
        paths: ["apps/web/vite.config.ts"],
      }),
    );
  });
  it("discovers declared members, resolves catalogs and preserves original specifiers", () => {
    const project = createWorkspaceProject(root, files, coverage);
    const members = workspacePackages(project);
    expect(members.map((member) => member.packagePath)).toEqual([".", "apps/web", "packages/ui"]);
    expect(members[0]!.role).toBe("orchestrator");
    expect(members[1]!.resolvedDependencies?.resolutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packageName: "react",
          declaredSpecifier: "catalog:",
          effectiveSpecifier: "^19.0.0",
          version: "19.2.3",
        }),
        expect.objectContaining({ packageName: "typescript", catalog: "tools", version: "6.0.3" }),
      ]),
    );
    expect(externalDeclarations(members[1]!).map((item) => item.name)).toEqual([
      "react",
      "typescript",
    ]);
    expect(members[1]!.files?.map((file) => file.path)).toEqual(["src/main.tsx"]);
    const evidence = createWorkspaceEvidence(project);
    expect(new Set(evidence.map((item) => item.id)).size).toBe(evidence.length);
    expect(evidence.some((item) => item.location?.path === "apps/web/package.json")).toBe(true);
  });
  it("rejects stale catalogs and records missing or malformed selected manifests", () => {
    const stale = files.map((file) =>
      file.path === "pnpm-workspace.yaml"
        ? { ...file, content: file.content.replace("^19.0.0", "^20.0.0") }
        : file,
    );
    const project = createWorkspaceProject(root, stale, coverage, [
      "apps/web/package.json",
      "packages/ui/package.json",
      "apps/missing/package.json",
    ]);
    expect(project.workspaceIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "workspace_manifest_unavailable" }),
        expect.objectContaining({ code: "lockfile_specifier_mismatch" }),
      ]),
    );
    expect(
      project.workspacePackages?.[1]?.resolvedDependencies?.resolutions.some(
        (item) => item.packageName === "react",
      ),
    ).toBe(false);
  });
  it("keeps duplicate package names separate and marks ambiguous internal references unresolved", () => {
    const project = createWorkspaceProject(
      root,
      [
        ...files,
        { path: "packages/duplicate/package.json", content: JSON.stringify({ name: "ui" }) },
      ],
      coverage,
    );
    expect(workspacePackages(project)).toHaveLength(4);
    expect(
      workspacePackages(project)[1]?.dependencies.find((item) => item.name === "ui")
        ?.internalPackagePath,
    ).toBeUndefined();
    expect(project.workspaceIssues).toContainEqual(
      expect.objectContaining({
        code: "workspace_dependency_unresolved",
        path: "apps/web/package.json",
      }),
    );
  });
  it("resolves npm workspace dependencies using the nearest lockfile installation", () => {
    const manifest = {
      ...normalizePackageManifest({ dependencies: { react: "^19.0.0" } }),
      packagePath: "apps/web",
    };
    const result = normalizeResolvedDependencies(manifest, [
      {
        path: "package-lock.json",
        content: JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "apps/web": { dependencies: { react: "^19.0.0" } },
            "node_modules/react": { version: "19.0.0" },
            "apps/web/node_modules/react": { version: "19.2.3" },
          },
        }),
      },
    ]);
    expect(result.snapshot?.resolutions[0]?.version).toBe("19.2.3");
  });
  it("rejects duplicate YAML keys and aliases without expanding them", () => {
    for (const content of [
      "packages: ['apps/*']\npackages: ['packages/*']",
      "packages: &list ['apps/*']\nother: *list",
    ]) {
      const project = createWorkspaceProject(
        root,
        [{ path: "pnpm-workspace.yaml", content }],
        coverage,
      );
      expect(project.workspaceIssues?.[0]?.code).toBe("workspace_configuration_invalid");
    }
  });
  it("scopes rule identifiers and reference links by canonical package path", () => {
    const project = createWorkspaceProject(root, files, coverage);
    const evidence = createWorkspaceEvidence(project);
    const context = {
      input: { type: "manifest" as const, fingerprint: "sha256:workspace" },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    };
    const inventory = scopeFactRule(dependencyInventoryRule).evaluate(context).facts ?? [];
    const resolutions = scopeFactRule(resolvedDependencyFactRule).evaluate(context).facts ?? [];
    const facts = [...inventory, ...resolutions];
    expect(new Set(facts.map((fact) => fact.id)).size).toBe(facts.length);
    expect(
      facts.every((fact) =>
        fact.evidenceIds.every((id) => evidence.some((item) => item.id === id)),
      ),
    ).toBe(true);
    expect(
      inventory.filter((fact) => fact.subject.name === "react").map((fact) => fact.subject.path),
    ).toEqual(["apps/web/package.json", "packages/ui/package.json"]);
    expect(resolutions.every((fact) => fact.subject.path === "pnpm-lock.yaml")).toBe(true);
  });
  it.each([
    ["packages/*", "!packages/excluded"],
    { packages: ["packages/*", "!packages/excluded"] },
  ])("supports npm and Yarn workspace declarations %j", (workspaces) => {
    const project = createWorkspaceProject(
      JSON.stringify({ workspaces }),
      [
        { path: "packages/library/package.json", content: "{}" },
        { path: "packages/excluded/package.json", content: "{}" },
        { path: "packages/broken/package.json", content: "{" },
        { path: "packages/broken/index.ts", content: "export {};" },
      ],
      coverage,
    );
    expect(workspacePackages(project).map((member) => member.packagePath)).toEqual([
      ".",
      "packages/library",
    ]);
    expect(project.files?.some((file) => file.path.includes("broken"))).toBe(false);
    expect(project.workspaceIssues).toContainEqual(
      expect.objectContaining({ code: "workspace_manifest_unavailable" }),
    );
  });
});
