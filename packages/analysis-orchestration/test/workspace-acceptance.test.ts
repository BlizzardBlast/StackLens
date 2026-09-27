import { describe, expect, it } from "vitest";

import { AnalysisReportSchema } from "@stacklens/contracts";
import type {
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
  NpmPackageMetadataRequest,
  NpmPackageMetadata,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
} from "@stacklens/data-sources";
import {
  createWorkspaceProject,
  workspacePackages,
  externalDeclarations,
  effectiveDependencyVersion,
  traceScripts,
} from "@stacklens/rules-javascript";

import { analyzePublicGitHubRepository } from "../src/index.js";
import frey from "./fixtures/frey-ui.json" with { type: "json" };
import kerja from "./fixtures/kerjalog.json" with { type: "json" };
import {
  createdAt,
  provider,
  repositorySuccess,
  npmSuccess,
  osvSuccess,
} from "./provider-fixtures.js";

async function analyzeFixture(
  fixture: typeof frey | typeof kerja,
  extra: { path: string; content: string }[],
  updates = 0,
) {
  const manifest = fixture.files.find((file) => file.path === "package.json")!.content;
  const files = [...fixture.files.filter((file) => file.path !== "package.json"), ...extra];
  const snapshot = repositorySuccess({ manifest });
  if (!snapshot.ok) throw new Error("Expected synthetic provider snapshot");
  const project = createWorkspaceProject(manifest, files, {
    complete: true,
    candidateSourceFiles: files.length,
    acquiredSourceFiles: files.length,
    lockfilePaths: files.filter((file) => file.path === "pnpm-lock.yaml").map((file) => file.path),
    lockfileIssueCount: 0,
  });
  const versions = new Map<string, Set<string>>();
  for (const member of workspacePackages(project))
    for (const dependency of externalDeclarations(member)) {
      const version = effectiveDependencyVersion(
        member,
        dependency.name,
        dependency.declaredSpecifier,
      )?.version;
      if (version !== undefined)
        versions.set(dependency.name, new Set([...(versions.get(dependency.name) ?? []), version]));
    }
  const updateNames = new Set([...versions.keys()].toSorted().slice(0, updates));
  const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
    "github-rest",
    async () => ({
      ...snapshot,
      data: {
        ...snapshot.data,
        repository: {
          provider: "github",
          owner: "BlizzardBlast",
          name: fixture.repository.split("/")[1]!,
          commitSha: fixture.commitSha,
        },
        files: files.map((file) => ({
          ...file,
          blobSha: "d".repeat(40),
          byteLength: Buffer.byteLength(file.content),
        })),
        manifestPaths: files
          .filter((file) => file.path.endsWith("/package.json"))
          .map((file) => file.path),
        workspaceDiscoveryComplete: true,
        sourceCoverage: {
          status: "complete",
          candidateFiles: files.length,
          acquiredFiles: files.length,
        },
      },
    }),
  );
  const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
    "npm-registry",
    async ({ packageName }) => {
      const current = [...(versions.get(packageName) ?? [])];
      const response = npmSuccess(
        packageName,
        current[0] ?? "1.0.0",
        updateNames.has(packageName) ? "999.0.0" : (current[0] ?? "1.0.0"),
      );
      if (!response.ok) throw new Error("Expected synthetic npm response");
      return {
        ...response,
        data: {
          ...response.data,
          versions: [
            ...new Set([...current, ...response.data.versions.map((item) => item.version)]),
          ].map((version) => ({ version })),
        },
      };
    },
  );
  const result = await analyzePublicGitHubRepository(
    {
      analysisId: "acceptance-report",
      createdAt,
      repositoryUrl: "https://github.com/" + fixture.repository,
    },
    {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider: provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
        "osv",
        async (request) => osvSuccess(request),
      ),
    },
  );
  if (!result.ok) throw new Error(result.error.code);
  return { report: AnalysisReportSchema.parse(result.report), project };
}

describe("pinned workspace acceptance [FR-005–FR-023, SCORE-001–004, SEC-001/002]", () => {
  it("inspects Frey-ui catalogs, JSONC, MDX, literal settings and real Turbo member scripts", async () => {
    const { report, project } = await analyzeFixture(frey, [
      {
        path: "packages/frey-ui/src/fixture.test.tsx",
        content: "import {test} from 'vitest'; test('synthetic file presence', () => {});",
      },
      {
        path: "apps/playwright/tests/fixture.spec.ts",
        content:
          "import {test} from '@playwright/test'; test('synthetic file presence', () => {});",
      },
    ]);
    expect(report.facts.filter((fact) => fact.details?.kind === "workspace_package")).toHaveLength(
      4,
    );
    expect(
      report.facts.some(
        (fact) =>
          fact.details?.kind === "dependency_resolution" && fact.details.catalog !== undefined,
      ),
    ).toBe(true);
    expect(
      traceScripts(project, project, "test").executions.some(
        (item) => item.packagePath === "packages/frey-ui" && item.executable === "vitest",
      ),
    ).toBe(true);
    expect(
      report.limitations.some((item) =>
        /strict JSON|unsupported first-slice formats/u.test(item.message),
      ),
    ).toBe(false);
    expect(
      report.facts
        .filter(
          (fact) =>
            fact.details?.kind === "inspection_check" && fact.details.key === "test.execution",
        )
        .map((fact) =>
          fact.details?.kind === "inspection_check" ? fact.details.state : undefined,
        ),
    ).toEqual(["not_applicable", "pass", "pass", "pass"]);
    expect(report.scores.categories.dependencies).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(report.scores.categories.tooling).toMatchObject({ status: "available", value: 100 });
    expect(
      report.facts.find(
        (fact) =>
          fact.details?.kind === "inspection_check" &&
          fact.details.key === "test.files" &&
          fact.details.packagePath === "packages/frey-ui",
      )?.details,
    ).toMatchObject({ state: "pass" });
  });
  it("keeps KerjaLog update and migration opportunities unscored with Expo-aware advice", async () => {
    // Manifest ranges receive synthetic matching resolutions in a minimal pnpm importer.
    const manifest: {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    } = JSON.parse(kerja.files[0]!.content);
    const lockfile =
      "lockfileVersion: '9.0'\nimporters:\n  .:\n" +
      (["dependencies", "devDependencies"] as const)
        .map(
          (group) =>
            "    " +
            group +
            ":\n" +
            Object.entries(manifest[group] ?? {})
              .map(
                ([name, specifier]) =>
                  "      " +
                  JSON.stringify(name) +
                  ":\n        specifier: " +
                  JSON.stringify(specifier) +
                  "\n        version: " +
                  JSON.stringify(specifier.replace(/^[~^]/u, "")) +
                  "\n",
              )
              .join(""),
        )
        .join("");
    const { report } = await analyzeFixture(
      kerja,
      [
        { path: "src/fixture.ts", content: "export {};" },
        { path: "pnpm-lock.yaml", content: lockfile },
      ],
      25,
    );
    expect(report.findings.filter((finding) => finding.rule.id === "JS-NPM-006")).toHaveLength(25);
    expect(report.scores.categories.dependencies).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(report.scores.categories.maintainability).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(
      report.scores.contributions.some((item) =>
        item.findingIds.some(
          (id) =>
            report.findings.find((finding) => finding.id === id)?.rule.id === "JS-MIGRATION-014",
        ),
      ),
    ).toBe(false);
    expect(report.recommendations.some((item) => /Expo/u.test(item.suggestion))).toBe(true);
  });
});
