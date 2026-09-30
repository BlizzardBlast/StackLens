import { describe, expect, it } from "vitest";

import {
  createWorkspaceProject,
  externalDeclarations,
  workspacePackages,
} from "../src/workspace.js";

function fixture(
  options: {
    version?: number;
    name?: string;
    target?: string;
    stale?: boolean;
    nested?: boolean;
    duplicateName?: boolean;
    content?: string;
    ambiguous?: boolean;
    external?: boolean;
  } = {},
) {
  const name = options.name ?? "local-lib";
  const root = {
    name: "root",
    workspaces: ["packages/*"],
    dependencies: { [name]: "1.0.0" },
    ...(options.ambiguous ? {} : { packageManager: "npm@11.0.0" }),
  };
  const app = { name: "app", dependencies: { [name]: "^1.0.0" } };
  const installation = options.external
    ? { version: "1.0.0" }
    : { link: true, resolved: options.target ?? "packages/lib" };
  const files = [
    { path: "packages/app/package.json", content: JSON.stringify(app) },
    { path: "packages/lib/package.json", content: JSON.stringify({ name, version: "1.0.0" }) },
    ...(options.duplicateName
      ? [
          {
            path: "packages/duplicate/package.json",
            content: JSON.stringify({ name, version: "1.0.0" }),
          },
        ]
      : []),
    {
      path: "package-lock.json",
      content:
        options.content ??
        JSON.stringify({
          lockfileVersion: options.version ?? 3,
          packages: {
            "": root,
            "packages/app": options.stale ? { ...app, dependencies: { [name]: "^2.0.0" } } : app,
            "packages/lib": { name, version: "1.0.0" },
            ["node_modules/" + name]: installation,
            ...(options.nested ? { ["packages/app/node_modules/" + name]: installation } : {}),
          },
        }),
    },
    ...(options.ambiguous ? [{ path: "yarn.lock", content: "# ambiguous fixture" }] : []),
  ];
  return createWorkspaceProject(JSON.stringify(root), files, {
    complete: true,
    candidateSourceFiles: 0,
    acquiredSourceFiles: 0,
    lockfilePaths: files
      .filter((file) => file.path.endsWith("lock.json") || file.path === "yarn.lock")
      .map((file) => file.path),
    lockfileIssueCount: 0,
  });
}

describe("npm internal links [FR-005, FR-023, SCORE-003, SEC-002]", () => {
  it("does not require installation evidence for peer-only constraints", () => {
    const project = createWorkspaceProject(
      JSON.stringify({
        packageManager: "npm@11.0.0",
        workspaces: ["packages/*"],
        peerDependencies: { lib: "^1.0.0" },
      }),
      [{ path: "packages/lib/package.json", content: JSON.stringify({ name: "lib" }) }],
      {
        complete: true,
        candidateSourceFiles: 0,
        acquiredSourceFiles: 0,
        lockfilePaths: [],
        lockfileIssueCount: 0,
      },
    );
    expect(project.workspaceIssues).toEqual([]);
    expect(externalDeclarations(project)).toEqual([]);
    expect(project.dependencies[0]?.unresolvedInternalTarget).toBeUndefined();
  });
  it.each([2, 3])("recognizes package-lock v%i root and hoisted member links", (version) => {
    const project = fixture({ version });
    for (const member of workspacePackages(project).slice(0, 2)) {
      expect(member.dependencies[0]).toMatchObject({ internalPackagePath: "packages/lib" });
      expect(externalDeclarations(member)).toEqual([]);
      expect(member.resolvedDependencies?.resolutions).toEqual([]);
    }
    expect(project.workspaceIssues).toEqual([]);
  });

  it("uses scoped names and nearest installations, preserving path identity with duplicate names", () => {
    const project = fixture({ name: "@local/lib", nested: true, duplicateName: true });
    expect(workspacePackages(project)[1]?.dependencies[0]).toMatchObject({
      internalPackagePath: "packages/lib",
      declaredSpecifier: "^1.0.0",
      group: "dependencies",
    });
    expect(project.workspaceIssues).toEqual([]);
  });

  it("does not infer internal identity from a matching workspace package name", () => {
    const project = fixture({ external: true });
    expect(externalDeclarations(workspacePackages(project)[1]!)).toHaveLength(1);
    expect(workspacePackages(project)[1]?.dependencies[0]?.internalPackagePath).toBeUndefined();
  });

  it.each(["packages/missing", "../outside", "/outside", "C:\\outside", "https://example.com/lib"])(
    "keeps target %s unresolved and out of providers",
    (target) => {
      const project = fixture({ target });
      const member = workspacePackages(project)[1]!;
      expect(member.dependencies[0]).toMatchObject({ unresolvedInternalTarget: true });
      expect(member.dependencies[0]?.internalPackagePath).toBeUndefined();
      expect(externalDeclarations(member)).toEqual([]);
      expect(project.workspaceIssues).toContainEqual(
        expect.objectContaining({ code: "workspace_dependency_unresolved" }),
      );
    },
  );

  it.each([{ stale: true }, { ambiguous: true }, { content: "{" }, { version: 1 }])(
    "does not trust incomplete link evidence: %j",
    (options) => {
      const project = fixture(options);
      expect(externalDeclarations(workspacePackages(project)[1]!)).toEqual([]);
      expect(workspacePackages(project)[1]?.dependencies[0]).toMatchObject({
        unresolvedInternalTarget: true,
      });
    },
  );

  it("prefers a member installation over a conflicting root installation", () => {
    const manifest = { packageManager: "npm@11.0.0", workspaces: ["packages/*"] };
    const app = { name: "app", dependencies: { lib: "1.0.0" } };
    const project = createWorkspaceProject(
      JSON.stringify(manifest),
      [
        { path: "packages/app/package.json", content: JSON.stringify(app) },
        { path: "packages/lib/package.json", content: JSON.stringify({ name: "lib" }) },
        {
          path: "package-lock.json",
          content: JSON.stringify({
            lockfileVersion: 3,
            packages: {
              "": manifest,
              "packages/app": app,
              "node_modules/lib": { link: true, resolved: "packages/lib" },
              "packages/app/node_modules/lib": { version: "1.0.0" },
            },
          }),
        },
      ],
      {
        complete: true,
        candidateSourceFiles: 0,
        acquiredSourceFiles: 0,
        lockfilePaths: ["package-lock.json"],
        lockfileIssueCount: 0,
      },
    );
    expect(externalDeclarations(workspacePackages(project)[1]!)).toHaveLength(1);
  });
});
