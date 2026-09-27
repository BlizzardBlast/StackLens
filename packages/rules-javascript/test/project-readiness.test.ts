import { describe, expect, it } from "vitest";

import {
  createReadinessEvidence,
  projectReadinessFactRule,
  projectReadinessFindingRule,
} from "../src/project-readiness.js";
import type { JavaScriptProjectSnapshot } from "../src/project-snapshot.js";

function project(overrides: Partial<JavaScriptProjectSnapshot> = {}): JavaScriptProjectSnapshot {
  return {
    dependencies: [{ name: "vitest", declaredSpecifier: "5.0.1", group: "devDependencies" }],
    packageManager: "pnpm@12.4.2",
    scripts: [{ name: "test", command: "vitest run" }],
    files: [{ path: "src/example.test.ts", content: "test('example', () => {});" }],
    repositoryCoverage: {
      complete: true,
      acquiredSourceFiles: 1,
      candidateSourceFiles: 1,
      lockfilePaths: ["pnpm-lock.yaml"],
      lockfileIssueCount: 0,
    },
    resolvedDependencies: {
      path: "pnpm-lock.yaml",
      packageManager: "pnpm",
      resolutions: [{ packageName: "vitest", declaredSpecifier: "5.0.1", version: "5.0.1" }],
      issues: [],
    },
    ...overrides,
  };
}
function inspect(snapshot: JavaScriptProjectSnapshot) {
  const context = {
    input: { type: "manifest" as const, fingerprint: "test" },
    project: snapshot,
    metadata: {},
    sources: [],
    limitations: [],
    partialFailures: [],
    evidence: createReadinessEvidence(snapshot),
  };
  const result = projectReadinessFactRule.evaluate(context);
  const findings = projectReadinessFindingRule.evaluate({ ...context, facts: result.facts ?? [] });
  return { ...result, ...findings };
}

describe("static readiness policy [FR-019, FR-020, FR-021, SCORE-003, SEC-001]", () => {
  it("establishes both scopes from complete setup evidence without running commands", () => {
    const result = inspect(project());
    expect(result.limitations).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(
      result.facts
        ?.filter((fact) => fact.type.startsWith("analysis.coverage."))
        .map((fact) => fact.type),
    ).toEqual(["analysis.coverage.testing", "analysis.coverage.tooling"]);
  });
  it("reports bounded absence as heuristic findings with provenance", () => {
    const result = inspect(project({ packageManager: "pnpm", files: [], scripts: [] }));
    expect(result.findings).toHaveLength(3);
    expect(
      result.findings?.every(
        (finding) => finding.classification === "heuristic" && finding.evidenceIds.length > 0,
      ),
    ).toBe(true);
    expect(result.limitations).toEqual([]);
  });
  it("does not penalize missing test files after truncation", () => {
    const result = inspect(
      project({
        files: [],
        repositoryCoverage: {
          complete: false,
          acquiredSourceFiles: 0,
          candidateSourceFiles: 300,
          lockfilePaths: ["pnpm-lock.yaml"],
          lockfileIssueCount: 0,
        },
      }),
    );
    expect(result.findings).toEqual([]);
    expect(
      result.limitations?.some((item) => item.message.includes("acquisition was partial")),
    ).toBe(true);
    expect(result.facts?.some((fact) => fact.type === "analysis.coverage.testing")).toBe(false);
  });
  it.each([
    "node custom-runner.js",
    'echo "text; vitest run"',
    "npm run custom",
    "vitest-helper run",
    "vitest --help",
  ])("keeps custom or quoted commands unknown: %s", (command) => {
    const result = inspect(project({ scripts: [{ name: "test", command }] }));
    expect(result.findings).toEqual([]);
    expect(
      result.limitations?.some((item) => item.message.includes("unsupported custom command")),
    ).toBe(true);
  });
  it("requires declared runners and accepts the built-in Node runner", () => {
    expect(
      inspect(project({ dependencies: [] })).limitations?.some((item) =>
        item.affectedCategories.includes("testing"),
      ),
    ).toBe(true);
    expect(
      inspect(project({ dependencies: [], scripts: [{ name: "test", command: "node --test" }] }))
        .limitations,
    ).toEqual([]);
  });
  it("keeps unsupported managers and partial lockfiles unscored", () => {
    const result = inspect(project({ packageManager: "bun@1.0.0" }));
    expect(result.findings).toEqual([]);
    expect(result.facts?.some((fact) => fact.type === "analysis.coverage.tooling")).toBe(false);
  });
  it("does not claim repository coverage for manifest-only input", () => {
    const result = inspect({ dependencies: [] });
    expect(result.findings).toEqual([]);
    expect(result.limitations).toHaveLength(2);
  });
  it.each(["stale", "incomplete", "manager-mismatch"])(
    "keeps %s lockfile evidence unknown",
    (kind) => {
      const snapshot = project();
      const result = inspect(
        project({
          resolvedDependencies: {
            path: "pnpm-lock.yaml",
            packageManager: kind === "manager-mismatch" ? "npm" : "pnpm",
            resolutions:
              kind === "incomplete"
                ? []
                : [
                    {
                      packageName: "vitest",
                      declaredSpecifier: kind === "stale" ? "4.0.0" : "5.0.1",
                      version: "5.0.1",
                    },
                  ],
            issues: [],
          },
          repositoryCoverage: snapshot.repositoryCoverage!,
        }),
      );
      expect(result.facts?.some((fact) => fact.type === "analysis.coverage.tooling")).toBe(false);
      expect(result.findings).toEqual([]);
    },
  );
  it.each([true, false])(
    "requires complete acquisition (%s) before a missing-lockfile finding",
    (complete) => {
      const { resolvedDependencies: _lockfile, ...snapshot } = project();
      const result = inspect({
        ...snapshot,
        repositoryCoverage: {
          complete,
          acquiredSourceFiles: 1,
          candidateSourceFiles: complete ? 1 : 100,
          lockfilePaths: [],
          lockfileIssueCount: 0,
        },
      });
      expect(result.findings?.filter((finding) => finding.category === "tooling")).toHaveLength(
        complete ? 1 : 0,
      );
      expect(result.facts?.some((fact) => fact.type === "analysis.coverage.tooling")).toBe(
        complete,
      );
    },
  );
});
