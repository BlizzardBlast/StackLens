import { describe, expect, it } from "vitest";

import { staticCommands, traceScripts } from "../src/script-graph.js";
import { babelSourceReferenceParser as parser } from "../src/source-parser.js";
import { withWorkspaceSourceUsage } from "../src/source-usage.js";
import { createWorkspaceProject } from "../src/workspace.js";

describe("FR-009 MDX and lexical module references", () => {
  it("parses executable MDX ESM and expressions while ignoring fenced examples and prose", () => {
    const source =
      "import {Meta} from '@storybook/addon-docs/blocks';\n\n<Meta title='Introduction' />\n\n# Welcome\n\n```tsx\nimport Example from 'not-a-real-usage';\n```\n\n{import('actual-expression')}\n";
    const result = parser.parse("Introduction.mdx", source);
    expect(result.issues).toEqual([]);
    expect(result.references.map((item) => item.specifier)).toEqual([
      "@storybook/addon-docs/blocks",
      "actual-expression",
    ]);
    expect(result.references[0]?.startLine).toBe(1);
    expect(result.references[1]?.startLine).toBe(11);
  });
  it("recognizes Frey-ui createRequire and immutable require.resolve aliases", () => {
    const result = parser.parse(
      "helper.mjs",
      "import {createRequire as factory} from 'node:module'; const require=factory(import.meta.url); function getTypescript(){const resolvedPath=require.resolve('typescript',{paths:[path.resolve(__dirname,'../apps/storybook')]}); return require(resolvedPath);}",
    );
    expect(result.issues).toEqual([]);
    expect(result.references.map((item) => item.specifier)).toEqual(["node:module", "typescript"]);
  });
  it("handles MDX comments, JSX expressions and spread attributes without compilation", () => {
    const result = parser.parse(
      "example.mdx",
      "{/* documentation comment */}\n\n<Component {...props} value={import('attribute-module')} />\n\n{<Other value={import('expression-module')} />}\n",
    );
    expect(result.issues).toEqual([]);
    expect(result.references.map((item) => item.specifier)).toEqual([
      "attribute-module",
      "expression-module",
    ]);
  });
  it.each([
    "const path=require.resolve('typescript'); let alias=path; alias='other'; require(alias);",
    "function load(require){ const path=require.resolve('typescript'); require(path); }",
    "const path=require.resolve('typescript'); function load(path){ require(path); }",
    "require.resolve=custom; const path=require.resolve('typescript'); require(path);",
    "import {createRequire} from 'untrusted'; const require=createRequire(import.meta.url); require('typescript');",
    "import {createRequire} from 'node:module'; let load=createRequire(import.meta.url); load=other; load('typescript');",
  ])("does not turn shadowed or reassigned bindings into usage: %s", (source) => {
    const result = parser.parse("helper.mjs", source);
    expect(result.references.some((item) => item.specifier === "typescript")).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe("FR-009 package ownership and coverage", () => {
  it.each(["custom-compiler", "pnpm exec custom-compiler"])(
    "preserves positive imports but prevents non-use claims for %s",
    (command) => {
      const project = withWorkspaceSourceUsage(
        createWorkspaceProject(
          JSON.stringify({
            scripts: { build: command },
            dependencies: { react: "19.0.0" },
          }),
          [{ path: "index.js", content: "import React from 'react';" }],
          {
            complete: true,
            candidateSourceFiles: 1,
            acquiredSourceFiles: 1,
            lockfilePaths: [],
            lockfileIssueCount: 0,
          },
        ),
        "complete",
      );
      expect(project.workspacePackages?.[0]?.sourceUsage?.coverage).toBe("partial");
      expect(
        project.workspacePackages?.[0]?.sourceUsage?.references.map((item) => item.packageName),
      ).toContain("react");
    },
  );
  it("keeps sibling declarations isolated while assigning ancestor tool usage", () => {
    const project = withWorkspaceSourceUsage(
      createWorkspaceProject(
        JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
          devDependencies: { eslint: "9.0.0" },
        }),
        [
          {
            path: "packages/a/package.json",
            content: JSON.stringify({ name: "a", dependencies: { react: "19.0.0" } }),
          },
          {
            path: "packages/b/package.json",
            content: JSON.stringify({ name: "b", dependencies: { react: "19.0.0" } }),
          },
          {
            path: "packages/a/index.ts",
            content: "import React from 'react'; import eslint from 'eslint';",
          },
          { path: "packages/b/index.ts", content: "export const value=1;" },
        ],
        {
          complete: true,
          candidateSourceFiles: 2,
          acquiredSourceFiles: 2,
          lockfilePaths: [],
          lockfileIssueCount: 0,
        },
      ),
      "complete",
    );
    expect(
      project.workspacePackages?.[0]?.sourceUsage?.references.map((item) => [
        item.packageName,
        item.path,
      ]),
    ).toEqual([["eslint", "packages/a/index.ts"]]);
    expect(
      project.workspacePackages?.[1]?.sourceUsage?.references.map((item) => item.packageName),
    ).toEqual(["react"]);
    expect(project.workspacePackages?.[2]?.sourceUsage?.references).toEqual([]);
    expect(project.workspacePackages?.[2]?.sourceUsage?.coverage).toBe("complete");
  });
  it("does not let one member parse failure erase another member's complete evidence", () => {
    const project = withWorkspaceSourceUsage(
      createWorkspaceProject(
        JSON.stringify({ workspaces: ["packages/*"] }),
        [
          { path: "packages/a/package.json", content: "{}" },
          { path: "packages/a/index.ts", content: "export {" },
          { path: "packages/b/package.json", content: "{}" },
          { path: "packages/b/index.ts", content: "export {};" },
        ],
        {
          complete: true,
          candidateSourceFiles: 2,
          acquiredSourceFiles: 2,
          lockfilePaths: [],
          lockfileIssueCount: 0,
        },
      ),
      "complete",
    );
    expect(project.workspacePackages?.[1]?.sourceUsage?.coverage).toBe("partial");
    expect(project.workspacePackages?.[2]?.sourceUsage?.coverage).toBe("complete");
  });
});

describe("FR-019 FR-020 bounded static script graph", () => {
  const root = JSON.stringify({
    private: true,
    packageManager: "pnpm@11.20.0",
    workspaces: ["packages/*"],
    devDependencies: { turbo: "2.0.0" },
    scripts: { test: "turbo run test" },
  });
  const coverage = {
    complete: true,
    candidateSourceFiles: 1,
    acquiredSourceFiles: 1,
    lockfilePaths: [],
    lockfileIssueCount: 0,
  };
  const files = [
    {
      path: "packages/ui/package.json",
      content: JSON.stringify({
        name: "ui",
        scripts: {
          test: "pnpm run unit",
          unit: "vitest run --passWithNoTests",
          lint: "biome lint src",
          typecheck: "tsc --noEmit",
        },
        devDependencies: { vitest: "3.0.0", "@biomejs/biome": "2.0.0", typescript: "5.0.0" },
      }),
    },
  ];
  it("resolves Turbo to member scripts and declared runners", () => {
    const project = createWorkspaceProject(root, files, coverage);
    const trace = traceScripts(project, project, "test");
    expect(trace.state).toBe("pass");
    expect(trace.executions).toMatchObject([
      { packagePath: "packages/ui", script: "unit", executable: "vitest" },
    ]);
    expect(traceScripts(project, project.workspacePackages![1]!, "lint").state).toBe("pass");
    expect(traceScripts(project, project.workspacePackages![1]!, "typecheck").state).toBe("pass");
  });
  it.each(["pnpm --filter ui test", "npm --workspace ui run test", "yarn workspace ui test"])(
    "supports static workspace selectors: %s",
    (command) => {
      const project = createWorkspaceProject(
        JSON.stringify({ ...JSON.parse(root), scripts: { test: command } }),
        files,
        coverage,
      );
      expect(traceScripts(project, project, "test").state).toBe("pass");
    },
  );
  it.each([
    "pnpm run test",
    "turbo run absent",
    "pnpm --filter 'ui...' test",
    "node custom-test.js",
    'echo "vitest" && unknown-command',
    "pnpm exec ".repeat(18) + "vitest",
  ])("preserves unknown delegation: %s", (command) => {
    const project = createWorkspaceProject(
      JSON.stringify({ ...JSON.parse(root), scripts: { test: command } }),
      files,
      coverage,
    );
    expect(traceScripts(project, project, "test").state).toBe("unknown");
  });
  it("does not treat quoted text or transpilation as a safeguard", () => {
    const project = createWorkspaceProject(
      JSON.stringify({
        scripts: { test: 'echo "vitest run"', typecheck: "vite build" },
        devDependencies: { vite: "6.0.0" },
      }),
      [],
      coverage,
    );
    expect(traceScripts(project, project, "test").state).toBe("fail");
    expect(traceScripts(project, project, "typecheck").state).toBe("unknown");
    expect(staticCommands('echo "vitest run" && pnpm test')).toEqual([
      ["echo", "vitest run"],
      ["pnpm", "test"],
    ]);
    expect(staticCommands("vitest $FLAGS")).toBeUndefined();
    expect(staticCommands("vitest || true")).toBeUndefined();
  });
});
