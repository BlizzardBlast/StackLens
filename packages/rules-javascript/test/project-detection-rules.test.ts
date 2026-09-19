import { describe, expect, it } from "vitest";

import type { AnalysisFact } from "@stacklens/contracts";

import {
  createDependencyInventoryEvidence,
  dependencyInventoryRule,
} from "../src/dependency-inventory.js";
import {
  dependencyOverlapFindingId,
  dependencyOverlapRule,
} from "../src/dependency-overlap.js";
import {
  frameworkToolDetectionFactId,
  frameworkToolDetectionRule,
} from "../src/framework-tool-detection.js";
import { normalizePackageManifest } from "../src/manifest.js";
import {
  createProjectConfigurationEvidence,
  projectConfigurationFactId,
  projectConfigurationRule,
} from "../src/project-configuration.js";
import { createJavaScriptProjectSnapshot } from "../src/project-snapshot.js";

function repositoryInput(fingerprint: string) {
  return {
    type: "repository" as const,
    fingerprint,
    repository: {
      provider: "github" as const,
      owner: "stacklens-fixture",
      name: "fixture-repository",
      commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ref: "main",
    },
  };
}

function dependencyFacts(manifest: unknown): {
  readonly project: ReturnType<typeof normalizePackageManifest>;
  readonly evidence: ReturnType<typeof createDependencyInventoryEvidence>;
  readonly facts: readonly AnalysisFact[];
} {
  const project = normalizePackageManifest(manifest);
  const evidence = createDependencyInventoryEvidence(project);
  const result = dependencyInventoryRule.evaluate({
    input: {
      type: "manifest",
      fingerprint: "fnv1a64:fixture",
    },
    project,
    metadata: {},
    sources: [],
    evidence,
    limitations: [],
    partialFailures: [],
  });

  return {
    project,
    evidence,
    facts: result.facts ?? [],
  };
}

describe("frameworkToolDetectionRule [FR-012, NFR-001, NFR-002]", () => {
  it("emits deterministic facts for supported declared frameworks and tools", () => {
    const fixture = dependencyFacts({
      dependencies: {
        next: "16.0.0",
        zustand: "5.0.0",
      },
      devDependencies: {
        "@biomejs/biome": "2.2.0",
        vite: "7.1.0",
        vitest: "5.0.1",
      },
      optionalDependencies: {
        vite: "7.1.0",
      },
    });

    const first = frameworkToolDetectionRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:tool-fixture",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
    });
    const second = frameworkToolDetectionRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:tool-fixture",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(first).toEqual(second);
    expect(first.facts?.map((fact) => fact.id)).toEqual([
      frameworkToolDetectionFactId("@biomejs/biome", "linter_formatter"),
      frameworkToolDetectionFactId("next", "framework"),
      frameworkToolDetectionFactId("vite", "build_tool"),
      frameworkToolDetectionFactId("vitest", "test_framework"),
      frameworkToolDetectionFactId("zustand", "state_management"),
    ]);
    expect(first.facts?.find((fact) => fact.subject.name === "Vite")).toMatchObject({
      type: "project.tool.build_tool",
      subject: {
        type: "tool",
        name: "Vite",
        path: "package.json",
      },
      rule: {
        id: "JS-TOOL-012",
        version: "1",
      },
      requirementIds: ["FR-012"],
    });
    expect(first.facts?.find((fact) => fact.subject.name === "Vite")?.evidenceIds).toHaveLength(2);
  });

  it("does not guess unsupported tools from package names or broad categories", () => {
    const fixture = dependencyFacts({
      dependencies: {
        "custom-test-helper": "1.0.0",
        "node-fetch": "3.3.2",
      },
    });

    const result = frameworkToolDetectionRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:unsupported-tools",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts).toEqual([]);
  });
});

describe("dependencyOverlapRule [FR-008, DATA-003, DATA-004, NFR-002]", () => {
  it("emits a medium-confidence heuristic only for an explicit supported overlap pair", () => {
    const fixture = dependencyFacts({
      devDependencies: {
        jest: "30.0.0",
        vitest: "5.0.1",
      },
    });

    const result = dependencyOverlapRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:overlap-fixture",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
      facts: fixture.facts,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings?.[0]).toMatchObject({
      id: dependencyOverlapFindingId("jest", "vitest", "test runner"),
      classification: "heuristic",
      category: "dependencies",
      subject: {
        type: "dependency_overlap",
        name: "jest + vitest",
        path: "package.json",
      },
      rule: {
        id: "JS-OVERLAP-008",
        version: "1",
      },
      requirementIds: ["FR-008", "DATA-003", "DATA-004"],
      confidence: {
        level: "medium",
      },
    });
    expect(result.findings?.[0]?.confidence.factIds).toHaveLength(2);
    expect(result.findings?.[0]?.description).toContain("test runner");
    expect(result.findings?.[0]?.description).toContain(
      "does not establish that either dependency is unnecessary",
    );
  });

  it("preserves all duplicate declaration facts/evidence in one overlap finding", () => {
    const fixture = dependencyFacts({
      dependencies: {
        axios: "1.12.0",
        ky: "1.10.0",
      },
      optionalDependencies: {
        axios: "1.12.0",
      },
    });

    const result = dependencyOverlapRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:duplicate-overlap",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
      facts: fixture.facts,
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings?.[0]?.factIds).toHaveLength(3);
    expect(result.findings?.[0]?.evidenceIds).toHaveLength(3);
  });

  it("does not infer overlap merely because two dependencies occupy a broad category", () => {
    const fixture = dependencyFacts({
      dependencies: {
        axios: "1.12.0",
        "node-fetch": "3.3.2",
      },
    });

    const result = dependencyOverlapRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:broad-category",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
      facts: fixture.facts,
    });

    expect(result.findings).toEqual([]);
  });

  it("orders multiple supported overlap findings deterministically", () => {
    const fixture = dependencyFacts({
      devDependencies: {
        "@biomejs/biome": "2.2.0",
        eslint: "9.0.0",
        jest: "30.0.0",
        prettier: "3.6.0",
        vitest: "5.0.1",
      },
    });

    const result = dependencyOverlapRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "fnv1a64:multi-overlap",
      },
      project: fixture.project,
      metadata: {},
      sources: [],
      evidence: fixture.evidence,
      limitations: [],
      partialFailures: [],
      facts: fixture.facts,
    });

    expect(result.findings?.map((finding) => finding.id)).toEqual([
      dependencyOverlapFindingId("@biomejs/biome", "eslint", "linting"),
      dependencyOverlapFindingId("@biomejs/biome", "prettier", "code formatting"),
      dependencyOverlapFindingId("jest", "vitest", "test runner"),
    ]);
  });
});

describe("createJavaScriptProjectSnapshot [FR-013, SEC-002]", () => {
  it("sorts static files deterministically and rejects duplicate or non-canonical paths", () => {
    const manifest = normalizePackageManifest({});

    const snapshot = createJavaScriptProjectSnapshot(manifest, [
      {
        path: "vite.config.ts",
        content: "export default {}",
      },
      {
        path: "config/tsconfig.app.json",
        content: "{}",
      },
    ]);

    expect(snapshot.files?.map((file) => file.path)).toEqual([
      "config/tsconfig.app.json",
      "vite.config.ts",
    ]);
    expect(() =>
      createJavaScriptProjectSnapshot(manifest, [
        { path: "vite.config.ts", content: "" },
        { path: "vite.config.ts", content: "" },
      ]),
    ).toThrow("duplicated");
    expect(() =>
      createJavaScriptProjectSnapshot(manifest, [{ path: "../vite.config.ts", content: "" }]),
    ).toThrow("canonical relative path");
    expect(() =>
      createJavaScriptProjectSnapshot(manifest, [{ path: "\\vite.config.ts", content: "" }]),
    ).toThrow("relative POSIX paths");
    expect(() =>
      createJavaScriptProjectSnapshot(manifest, [{ path: "vite\nconfig.ts", content: "" }]),
    ).toThrow("relative POSIX paths");
  });
});

describe("projectConfigurationRule [FR-013, FR-021, SEC-001, SEC-002]", () => {
  it("statically inspects supported strict-JSON configuration characteristics", () => {
    const project = createJavaScriptProjectSnapshot(normalizePackageManifest({}), [
      {
        path: "tsconfig.json",
        content: JSON.stringify({
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            jsx: "react-jsx",
            module: "ESNext",
            target: "ES2022",
          },
        }),
      },
      {
        path: ".prettierrc.json",
        content: JSON.stringify({
          semi: true,
          singleQuote: false,
          printWidth: 100,
        }),
      },
    ]);
    const evidence = createProjectConfigurationEvidence(project);
    const result = projectConfigurationRule.evaluate({
      input: repositoryInput("commit:fixture"),
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.limitations).toEqual([]);
    expect(result.facts).toHaveLength(2);
    expect(result.facts?.map((fact) => fact.id)).toEqual([
      projectConfigurationFactId(".prettierrc.json", "prettier"),
      projectConfigurationFactId("tsconfig.json", "typescript"),
    ]);
    expect(result.facts?.find((fact) => fact.subject.path === "tsconfig.json")?.statement).toContain(
      "strict=true",
    );
    expect(result.facts?.find((fact) => fact.subject.path === "tsconfig.json")?.statement).toContain(
      'jsx="react-jsx"',
    );
    expect(result.facts?.find((fact) => fact.subject.path === ".prettierrc.json")?.statement).toContain(
      "printWidth=100",
    );
    expect(evidence.every((item) => item.location?.startLine === undefined)).toBe(true);
  });

  it("identifies dynamic configuration without executing or evaluating its content", () => {
    const project = createJavaScriptProjectSnapshot(normalizePackageManifest({}), [
      {
        path: "vite.config.ts",
        content:
          'throw new Error("THIS MUST NEVER RUN"); process.exit(99); export default defineConfig({});',
      },
    ]);
    const evidence = createProjectConfigurationEvidence(project);
    const result = projectConfigurationRule.evaluate({
      input: repositoryInput("commit:dynamic-config"),
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts?.[0]).toMatchObject({
      type: "project.configuration.vite",
      subject: {
        path: "vite.config.ts",
      },
      rule: {
        id: "JS-CONFIG-013",
        version: "1",
      },
    });
    expect(result.facts?.[0]?.statement).toContain("was not executed or evaluated");
    expect(result.limitations).toEqual([
      expect.objectContaining({
        kind: "unsupported_configuration",
        affectedCategories: ["tooling"],
        ruleIds: ["JS-CONFIG-013"],
        message: expect.stringContaining("did not import, execute, or resolve dynamic values"),
      }),
    ]);
  });

  it("reports JSONC/comments as partial static inspection rather than guessing", () => {
    const project = createJavaScriptProjectSnapshot(normalizePackageManifest({}), [
      {
        path: "biome.jsonc",
        content: '{\n  // comment\n  "formatter": { "enabled": true }\n}',
      },
    ]);
    const evidence = createProjectConfigurationEvidence(project);
    const result = projectConfigurationRule.evaluate({
      input: repositoryInput("commit:jsonc"),
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts?.[0]?.statement).toContain("Inspection is partial");
    expect(result.facts?.[0]?.statement).not.toContain("executable configuration code");
    expect(result.limitations).toEqual([
      expect.objectContaining({
        kind: "unsupported_configuration",
        message: expect.stringContaining("JSONC/comments"),
      }),
    ]);
  });

  it("preserves file detection while limiting malformed shapes and oversized configuration", () => {
    const oversized = JSON.stringify({
      compilerOptions: {
        strict: true,
      },
      padding: "x".repeat(600_000),
    });
    const project = createJavaScriptProjectSnapshot(normalizePackageManifest({}), [
      {
        path: ".eslintrc.json",
        content: JSON.stringify({
          plugins: "not-an-array",
        }),
      },
      {
        path: "tsconfig.json",
        content: oversized,
      },
    ]);
    const evidence = createProjectConfigurationEvidence(project);
    const result = projectConfigurationRule.evaluate({
      input: repositoryInput("commit:partial-config"),
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts).toHaveLength(2);
    expect(result.limitations).toEqual([
      expect.objectContaining({
        kind: "unsupported_configuration",
        message: expect.stringContaining("unsupported value type"),
      }),
      expect.objectContaining({
        kind: "resource_limit",
        message: expect.stringContaining("inspection limit"),
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("x".repeat(100));
  });

  it("ignores unrelated source files instead of guessing that they are configuration", () => {
    const project = createJavaScriptProjectSnapshot(normalizePackageManifest({}), [
      {
        path: "src/index.ts",
        content: "export const value = 1;",
      },
      {
        path: "README.md",
        content: "# fixture",
      },
    ]);
    const evidence = createProjectConfigurationEvidence(project);
    const result = projectConfigurationRule.evaluate({
      input: repositoryInput("commit:unrelated"),
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(evidence).toEqual([]);
    expect(result).toEqual({
      facts: [],
      limitations: [],
    });
  });
});
