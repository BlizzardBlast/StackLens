import { describe, expect, it } from "vitest";

import type { InspectionCheckDetails } from "@stacklens/contracts";
import { stackHealthScorer } from "@stacklens/scoring";

import type { JavaScriptAnalysisMetadata } from "../src/analysis-metadata.js";
import type { JavaScriptStaticProjectFile } from "../src/project-snapshot.js";
import { workspaceInspectionRule } from "../src/workspace-inspection.js";
import { createWorkspaceEvidence } from "../src/workspace-rules.js";
import { createWorkspaceProject } from "../src/workspace.js";

function inspect(
  manifest: unknown,
  files: JavaScriptStaticProjectFile[],
  metadata: JavaScriptAnalysisMetadata = {},
  complete = true,
) {
  const project = createWorkspaceProject(JSON.stringify(manifest), files, {
    complete,
    candidateSourceFiles: files.length,
    acquiredSourceFiles: files.length,
    lockfilePaths: [],
    lockfileIssueCount: 0,
  });
  const registry = metadata.npmRegistry ?? [];
  const result = workspaceInspectionRule.evaluate({
    input: { type: "manifest", fingerprint: "fixture" },
    project,
    metadata,
    sources: registry.map((item) => ({
      id: item.sourceId,
      provider: "npm-registry",
      status: "partial",
      retrievedAt: "2026-09-26T00:00:00Z",
    })),
    evidence: [
      ...createWorkspaceEvidence(project),
      ...registry.map((item) => ({
        id: "evidence-" + item.sourceId,
        kind: "external" as const,
        sourceId: item.sourceId,
        reference: item.snapshot.packageName,
        summary: "Current version registry record.",
      })),
    ],
    limitations: [],
    partialFailures: [],
  });
  const checks =
    result.facts?.flatMap((fact) =>
      fact.details?.kind === "inspection_check" ? [fact.details] : [],
    ) ?? [];
  return {
    result,
    checks,
    state: (key: string, path = "."): InspectionCheckDetails["state"] | undefined =>
      checks.find((item) => item.key === key && item.packagePath === path)?.state,
  };
}
describe("FR-018 FR-019 FR-020 FR-023 named workspace checks", () => {
  it.each([
    "src/example.test.js",
    "src/example-test.cjs",
    "src/example_test.mjs",
    "src/test-example.js",
    "src/test.js",
    "test/example.js",
    "nested/test/helper.js",
  ])("recognizes Node default discovery: %s", (path) => {
    expect(
      inspect({ scripts: { test: "node --test" } }, [{ path, content: "export {};" }]).state(
        "test.files",
      ),
    ).toBe("pass");
  });
  it.each(["src/example.spec.js", "__tests__/helper.js", "src/example.test.jsx"])(
    "does not borrow other runners' discovery: %s",
    (path) => {
      const files = [{ path, content: "export {};" }];
      expect(inspect({ scripts: { test: "node --test" } }, files).state("test.files")).toBe("fail");
      expect(
        inspect({ scripts: { test: "node --test" } }, files, {}, false).state("test.files"),
      ).toBe("unknown");
    },
  );
  it("keeps runtime-dependent Node TypeScript and selection flags unknown", () => {
    expect(
      inspect({ scripts: { test: "node --test test" } }, [
        { path: "src/example.test.js", content: "export {};" },
      ]).state("test.files"),
    ).toBe("unknown");
    expect(
      inspect({ scripts: { test: "node --test" } }, [
        { path: "test/example.ts", content: "export {};" },
      ]).state("test.files"),
    ).toBe("unknown");
    expect(
      inspect({ scripts: { test: "node --test other/*.js" } }, [
        { path: "test/example.js", content: "export {};" },
      ]).state("test.files"),
    ).toBe("unknown");
  });
  it.each([
    ["src/example.spec.js", 50],
    ["test/example.js", 100],
  ] as const)("scores supported Node setup for %s as %i", (path, expected) => {
    const { result } = inspect({ scripts: { test: "node --test" } }, [
      { path, content: "export {};" },
    ]);
    const scores = stackHealthScorer.score({
      facts: result.facts ?? [],
      findings: [],
      sources: [],
      evidence: [],
      limitations: result.limitations ?? [],
      partialFailures: [],
    });
    expect(scores.categories.testing).toMatchObject({ status: "available", value: expected });
  });
  it("keeps Playwright matches within testDir and ignores unrelated runner configuration", () => {
    const files = [
      { path: "src/example.test.ts", content: "export {};" },
      { path: "jest.config.js", content: "export default {};" },
      {
        path: "playwright.config.ts",
        content:
          "import {defineConfig} from '@playwright/test'; export default defineConfig({testDir:'./e2e',testMatch:'**/*.test.ts'});",
      },
    ];
    const manifest = {
      scripts: { test: "playwright test" },
      devDependencies: { "@playwright/test": "1.56.0" },
    };
    expect(inspect(manifest, files).state("test.files")).toBe("fail");
    expect(
      inspect(manifest, [...files, { path: "e2e/example.test.ts", content: "export {};" }]).state(
        "test.files",
      ),
    ).toBe("pass");
  });
  it("respects inline Jest selection and preserves opaque preset uncertainty", () => {
    const manifest = { scripts: { test: "jest" }, devDependencies: { jest: "30.0.0" } };
    const files = [{ path: "src/example.test.ts", content: "export {};" }];
    expect(
      inspect({ ...manifest, jest: { testMatch: ["other/**/*.test.ts"] } }, files).state(
        "test.files",
      ),
    ).toBe("fail");
    expect(inspect({ ...manifest, jest: { preset: "jest-expo" } }, files).state("test.files")).toBe(
      "unknown",
    );
  });
  it("does not fail a type-check command because another target disables checking", () => {
    const result = inspect(
      {
        scripts: { typecheck: "tsc --project tsconfig.checked.json" },
        devDependencies: { typescript: "5.8.0" },
      },
      [
        { path: "src/index.ts", content: "export {};" },
        { path: "tsconfig.checked.json", content: "{}" },
        { path: "tsconfig.build.json", content: '{"compilerOptions":{"noCheck":true}}' },
      ],
    );
    expect(result.state("typecheck")).toBe("unknown");
  });
  it("does not infer matching tests across unsupported CLI overrides or delegated arguments", () => {
    const files = [{ path: "src/a.test.ts", content: "export {};" }];
    for (const command of [
      "vitest run other",
      "vitest --config custom.ts",
      "npm run unit -- --help",
    ]) {
      const result = inspect(
        { scripts: { test: command, unit: "vitest run" }, devDependencies: { vitest: "3.0.0" } },
        files,
      );
      expect(result.state("test.files")).toBe("unknown");
    }
  });
  it("does not penalize ordinary JavaScript for lacking TypeScript", () => {
    const result = inspect(
      { scripts: { lint: "eslint src" }, devDependencies: { eslint: "9.0.0" } },
      [
        { path: "src/index.js", content: "export {};" },
        {
          path: "eslint.config.mjs",
          content: "import preset from 'preset'; export default preset;",
        },
      ],
    );
    expect(result.state("lint")).toBe("pass");
    expect(result.state("typecheck")).toBe("not_applicable");
  });
  it("recognizes type-checking separately from Vite transpilation", () => {
    const files = [{ path: "src/index.ts", content: "export {};" }];
    expect(
      inspect(
        { scripts: { typecheck: "tsc --noEmit" }, devDependencies: { typescript: "5.0.0" } },
        files,
      ).state("typecheck"),
    ).toBe("pass");
    expect(
      inspect(
        { scripts: { typecheck: "vite build" }, devDependencies: { vite: "6.0.0" } },
        files,
      ).state("typecheck"),
    ).toBe("unknown");
  });
  it("does not count passWithNoTests as test-file evidence", () => {
    const result = inspect(
      { scripts: { test: "vitest run --passWithNoTests" }, devDependencies: { vitest: "3.0.0" } },
      [{ path: "src/index.ts", content: "export {};" }],
    );
    expect(result.state("test.execution")).toBe("pass");
    expect(result.state("test.files")).toBe("fail");
  });
  it("matches explicit Vitest includes and keeps opaque coverage defaults non-blocking", () => {
    const result = inspect(
      { scripts: { test: "vitest run" }, devDependencies: { vitest: "3.0.0" } },
      [
        { path: "src/example.test.ts", content: "export {};" },
        {
          path: "vitest.config.ts",
          content:
            "import {defineConfig,coverageConfigDefaults} from 'vitest/config'; export default defineConfig({test:{include:['other/**/*.test.ts'],coverage:{exclude:[...coverageConfigDefaults.exclude]}}});",
        },
      ],
    );
    expect(result.state("test.files")).toBe("fail");
    expect(result.state("test.execution")).toBe("pass");
  });
  it("aggregates member checks without duplicating an orchestration-only root", () => {
    const result = inspect(
      {
        workspaces: ["packages/*"],
        scripts: { test: "turbo run test" },
        devDependencies: { turbo: "2.0.0" },
      },
      [
        {
          path: "packages/ui/package.json",
          content: JSON.stringify({
            name: "ui",
            scripts: { test: "vitest run" },
            devDependencies: { vitest: "3.0.0" },
          }),
        },
        { path: "packages/ui/src/a.test.ts", content: "export {};" },
      ],
    );
    expect(result.state("test.execution")).toBe("not_applicable");
    expect(result.state("test.execution", "packages/ui")).toBe("pass");
    expect(result.state("test.files", "packages/ui")).toBe("pass");
    expect(result.checks.filter((item) => item.category === "tooling")).toHaveLength(2);
  });
  it("does not require latest metadata for a completed current-version deprecation check", () => {
    const result = inspect(
      { dependencies: { fixture: "1.0.0" } },
      [{ path: "src/index.js", content: "export {};" }],
      {
        npmRegistry: [
          {
            sourceId: "npm-fixture",
            snapshot: { packageName: "fixture", distTags: [], versions: [{ version: "1.0.0" }] },
          },
        ],
      },
    );
    expect(result.checks.find((item) => item.key.startsWith("deprecation."))?.state).toBe("pass");
    expect(result.checks.find((item) => item.key.startsWith("advisories."))?.state).toBe("unknown");
  });
});
