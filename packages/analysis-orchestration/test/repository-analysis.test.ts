import { describe, expect, it } from "vitest";

import { AnalysisReportSchema } from "@stacklens/contracts";
import type {
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
  NpmPackageMetadata,
  NpmPackageMetadataRequest,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
} from "@stacklens/data-sources";

import {
  analyzePublicGitHubRepository,
  REPOSITORY_METADATA_LIMITATION_ID,
  REPOSITORY_OSV_LIMITATION_ID,
} from "../src/index.js";
import {
  createdAt,
  commitSha,
  provider,
  repositorySuccess,
  npmSuccess,
  npmFailure,
  osvSuccess,
} from "./provider-fixtures.js";

const baseCommand = {
  analysisId: "analysis-repository-demo",
  createdAt,
  repositoryUrl: "https://github.com/acme/demo",
} as const;

describe("analyzePublicGitHubRepository [FR-003–FR-023, NFR-003, NFR-008, NFR-009]", () => {
  it("keeps an unpinned workspace dependency out of providers without lockfile evidence [FR-005, FR-023, SCORE-003]", async () => {
    const manifest = JSON.stringify({
      workspaces: ["packages/*"],
      dependencies: { "local-lib": "1.0.0" },
    });
    const snapshot = repositorySuccess({ manifest });
    if (!snapshot.ok) throw new Error("Expected fixture snapshot");
    const memberContent = JSON.stringify({ name: "local-lib", version: "1.0.0" });
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () => ({
        ...snapshot,
        data: {
          ...snapshot.data,
          files: [
            ...snapshot.data.files,
            {
              path: "packages/lib/package.json",
              content: memberContent,
              blobSha: "e".repeat(40),
              byteLength: memberContent.length,
            },
          ],
          manifestPaths: ["package.json", "packages/lib/package.json"],
          workspaceDiscoveryComplete: true,
        },
      }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });
    expect(npmRegistryProvider.fetchMock).not.toHaveBeenCalled();
    expect(osvProvider.fetchMock).not.toHaveBeenCalled();
    if (!result.ok) throw new Error("Expected workspace report");
    expect(result.report.partialFailures).toEqual([]);
    expect(result.report.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "dependency.inventory",
          subject: expect.objectContaining({ name: "local-lib" }),
        }),
      ]),
    );
    expect(result.report.facts.some((fact) => fact.type === "dependency.workspace.internal")).toBe(
      false,
    );
    expect(result.report.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reasonCode: "workspace_dependency_unresolved" }),
      ]),
    );
    for (const category of ["dependencies", "security"] as const)
      expect(result.report.scores.categories[category].status).toBe("insufficient_evidence");
    expect(AnalysisReportSchema.safeParse(result.report).success).toBe(true);
  });

  it.each(["packages/lib", "packages/missing", "../outside"])(
    "never queries external providers for npm link target %s [FR-005, FR-023]",
    async (target) => {
      const manifest = {
        workspaces: ["packages/*"],
        packageManager: "npm@11.0.0",
        dependencies: { "local-lib": "1.0.0" },
      };
      const snapshot = repositorySuccess({
        manifest: JSON.stringify(manifest),
        lockfile: {
          path: "package-lock.json",
          content: JSON.stringify({
            lockfileVersion: 3,
            packages: {
              "": manifest,
              "node_modules/local-lib": { link: true, resolved: target },
              "packages/lib": { name: "local-lib", version: "1.0.0" },
            },
          }),
        },
      });
      if (!snapshot.ok) throw new Error("Expected fixture snapshot");
      const memberContent = JSON.stringify({ name: "local-lib", version: "1.0.0" });
      const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
        "github-rest",
        async () => ({
          ...snapshot,
          data: {
            ...snapshot.data,
            files: [
              ...snapshot.data.files,
              {
                path: "packages/lib/package.json",
                content: memberContent,
                blobSha: "e".repeat(40),
                byteLength: memberContent.length,
              },
            ],
            manifestPaths: ["package.json", "packages/lib/package.json"],
            workspaceDiscoveryComplete: true,
          },
        }),
      );
      const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
        "npm-registry",
        async () => {
          throw new Error("Internal links must not query npm");
        },
      );
      const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
        "osv",
        async () => {
          throw new Error("Internal links must not query OSV");
        },
      );
      const result = await analyzePublicGitHubRepository(baseCommand, {
        githubRepositoryProvider,
        npmRegistryProvider,
        osvProvider,
      });
      expect(npmRegistryProvider.fetchMock).not.toHaveBeenCalled();
      expect(osvProvider.fetchMock).not.toHaveBeenCalled();
      if (!result.ok) throw new Error("Expected workspace report");
      expect(result.report.partialFailures).toEqual([]);
      expect(
        result.report.facts.some(
          (fact) => fact.type === "dependency.inventory" && fact.subject.name === "local-lib",
        ),
      ).toBe(true);
      expect(
        result.report.facts.some((fact) => fact.type === "dependency.workspace.internal"),
      ).toBe(target === "packages/lib");
      expect(
        result.report.findings.filter((finding) =>
          ["dependencies", "security"].includes(finding.category),
        ),
      ).toEqual([]);
      for (const category of ["dependencies", "security"] as const) {
        expect(result.report.scores.categories[category].status).toBe(
          target === "packages/lib" ? "not_applicable" : "insufficient_evidence",
        );
      }
      expect(AnalysisReportSchema.safeParse(result.report).success).toBe(true);
    },
  );
  it("deduplicates workspace providers while keeping versions distinct and peers internal", async () => {
    const snapshot = repositorySuccess({
      manifest: JSON.stringify({
        workspaces: ["packages/*"],
        peerDependencies: { "peer-only": "1.0.0" },
      }),
    });
    if (!snapshot.ok) throw new Error("Expected fixture snapshot");
    const files = [
      {
        path: "packages/a/package.json",
        content: JSON.stringify({ name: "a", dependencies: { shared: "1.0.0", b: "workspace:*" } }),
      },
      {
        path: "packages/b/package.json",
        content: JSON.stringify({ name: "b", dependencies: { shared: "2.0.0" } }),
      },
      {
        path: "packages/c/package.json",
        content: JSON.stringify({ name: "c", dependencies: { shared: "1.0.0" } }),
      },
    ];
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () => ({
        ...snapshot,
        data: {
          ...snapshot.data,
          files: files.map((file) => ({
            ...file,
            blobSha: "e".repeat(40),
            byteLength: file.content.length,
          })),
          manifestPaths: files.map((file) => file.path),
          workspaceDiscoveryComplete: true,
        },
      }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0", "2.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );
    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });
    expect(result.ok).toBe(true);
    expect(npmRegistryProvider.fetchMock).toHaveBeenCalledExactlyOnceWith({
      packageName: "shared",
    });
    expect(osvProvider.fetchMock).toHaveBeenCalledExactlyOnceWith({
      queries: [
        { packageName: "shared", version: "1.0.0" },
        { packageName: "shared", version: "2.0.0" },
      ],
    });
    if (!result.ok) throw new Error("Expected workspace report");
    expect(
      result.report.facts.filter((fact) => fact.details?.kind === "workspace_package"),
    ).toHaveLength(4);
    expect(
      result.report.facts.filter(
        (fact) =>
          fact.details?.kind === "inspection_check" &&
          fact.details.category === "dependencies" &&
          fact.details.packageName === "shared",
      ),
    ).toHaveLength(3);
  });
  it("composes repository, npm, OSV, production rules, recommendations, and scoring", async () => {
    const secretSourceText =
      'import legacy from "legacy-package"; import React from "react"; const TOP_SECRET_SOURCE_VALUE = "never-retain"; export const value = [legacy, React.version, TOP_SECRET_SOURCE_VALUE];';
    const manifest = JSON.stringify({
      dependencies: {
        "legacy-package": "1.0.0",
        react: "18.2.0",
      },
      scripts: {
        postinstall: "never-retain-this-script",
      },
    });
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () => repositorySuccess({ manifest, sourceContent: secretSourceText }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) =>
        packageName === "legacy-package"
          ? npmSuccess(packageName, "1.0.0", "2.0.0")
          : npmSuccess(packageName, "18.2.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );
    const observedProgress: unknown[] = [];
    let releaseFirstProgress!: () => void;
    const firstProgressGate = new Promise<void>((resolve) => {
      releaseFirstProgress = resolve;
    });
    let firstProgressObserved = false;

    const analysisPromise = analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
      async onProgress(progress) {
        if (!firstProgressObserved) {
          firstProgressObserved = true;
          await firstProgressGate;
        }

        observedProgress.push(progress);
      },
    });

    expect(firstProgressObserved).toBe(true);
    expect(githubRepositoryProvider.fetchMock).not.toHaveBeenCalled();

    releaseFirstProgress();

    const result = await analysisPromise;

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected repository analysis to succeed");
    }

    expect(result.report.input).toEqual({
      type: "repository",
      fingerprint: `github:acme/demo@${commitSha}`,
      repository: {
        provider: "github",
        owner: "acme",
        name: "demo",
        commitSha,
        ref: "main",
      },
    });
    expect(result.report.analyzer).toEqual({
      version: "javascript-production-v5",
      ruleSetVersion: "javascript-rules-v5",
      scoringVersion: "stack-health-v3",
    });

    const migration = result.report.findings.find(
      (finding) =>
        finding.rule.id === "JS-MIGRATION-014" && finding.subject.name === "legacy-package",
    );
    expect(migration).toMatchObject({
      classification: "heuristic",
      priority: {
        level: "low",
        rule: {
          id: "JS-PRIORITY-016",
          version: "2",
        },
      },
    });
    expect(
      result.report.recommendations.some((recommendation) =>
        recommendation.findingIds.includes(migration?.id ?? ""),
      ),
    ).toBe(true);
    expect(result.report.scores.categories.dependencies).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(result.report.scores.categories.security).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(result.report.scores.overall).toMatchObject({
      status: "available",
      value: 40,
    });
    for (const category of ["maintainability", "testing", "tooling"] as const)
      expect(result.report.scores.categories[category]).toMatchObject({
        status: "available",
        value: 0,
      });
    expect(osvProvider.fetchMock).toHaveBeenCalledWith({
      queries: [
        {
          packageName: "legacy-package",
          version: "1.0.0",
        },
        {
          packageName: "react",
          version: "18.2.0",
        },
      ],
    });
    expect(result.progress.at(-1)).toEqual({
      phase: "analysis",
      status: "completed",
    });
    expect(observedProgress).toEqual(result.progress);
    expect(AnalysisReportSchema.safeParse(result.report).success).toBe(true);

    const serializedResult = JSON.stringify(result);
    expect(serializedResult).not.toContain("TOP_SECRET_SOURCE_VALUE");
    expect(serializedResult).not.toContain("never-retain-this-script");
    expect(serializedResult).not.toContain("never-retain");
  });

  it("uses pnpm lockfile resolutions for ranged dependency scoring and OSV queries", async () => {
    const manifest = JSON.stringify({
      packageManager: "pnpm@11.20.0",
      dependencies: {
        react: "^19.0.0",
      },
    });
    const lockfile = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      react:
        specifier: ^19.0.0
        version: 19.2.3
`;
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () =>
        repositorySuccess({
          manifest,
          lockfile: {
            path: "pnpm-lock.yaml",
            content: lockfile,
          },
          sourceContent: 'import React from "react"; export const value = React.version;',
        }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "19.2.3", "19.2.4"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected lockfile-backed repository analysis to succeed");
    }

    expect(osvProvider.fetchMock).toHaveBeenCalledWith({
      queries: [
        {
          packageName: "react",
          version: "19.2.3",
        },
      ],
    });
    expect(result.report.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "dependency.resolution",
          subject: expect.objectContaining({
            name: "react",
            path: "pnpm-lock.yaml",
          }),
          statement: expect.stringContaining("19.2.3"),
        }),
      ]),
    );
    expect(result.report.scores.categories.dependencies).toMatchObject({
      status: "available",
    });
    expect(result.report.scores.categories.security).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(result.report.scores.overall).toMatchObject({
      status: "available",
    });
    expect(JSON.stringify(result.report)).not.toContain(lockfile);
  });

  it("keeps npm acquisition failure non-fatal and marks dependency scoring N/A", async () => {
    const manifest = JSON.stringify({
      dependencies: {
        react: "18.2.0",
      },
    });
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () =>
        repositorySuccess({
          manifest,
          sourceContent: 'import React from "react"; export const value = React.version;',
        }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmFailure(packageName),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial external-data failure to preserve analysis");
    }

    expect(result.report.partialFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "npm_request_timeout",
          sourceId: "source-npm-react",
        }),
      ]),
    );
    expect(result.report.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source-npm-react",
          status: "unavailable",
        }),
      ]),
    );
    expect(result.report.scores.categories.dependencies.status).toBe("insufficient_evidence");
    expect(result.report.scores.categories.security).toMatchObject({
      status: "available",
      value: 100,
    });
    expect(result.report.scores.overall.status).toBe("insufficient_evidence");
    expect(result.progress).toEqual(
      expect.arrayContaining([
        {
          phase: "package_metadata",
          status: "completed",
          completed: 1,
          total: 1,
          failed: 1,
        },
      ]),
    );
    expect(AnalysisReportSchema.safeParse(result.report).success).toBe(true);
  });

  it("skips OSV when no exact current version is provable", async () => {
    const manifest = JSON.stringify({
      dependencies: {
        react: "^18.2.0",
      },
    });
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () =>
        repositorySuccess({
          manifest,
          sourceContent: 'import React from "react"; export const value = React.version;',
        }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "18.2.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected range-based repository analysis to succeed with limitations");
    }

    expect(osvProvider.fetchMock).not.toHaveBeenCalled();
    expect(result.progress).toContainEqual({
      phase: "vulnerability_data",
      status: "skipped",
      completed: 0,
      total: 0,
      failed: 0,
    });
    expect(result.report.scores.categories.security.status).toBe("insufficient_evidence");
    expect(
      result.report.limitations.some((limitation) =>
        limitation.message.includes("no supported exact current version"),
      ),
    ).toBe(true);
  });

  it("returns a clear terminal error when GitHub acquisition fails before metadata work", async () => {
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () => ({
        ok: false,
        source: {
          id: "source-github-unavailable",
          provider: "github-rest",
          status: "unavailable",
          attemptedAt: createdAt,
        },
        failure: {
          id: "failure-github-unavailable",
          scope: "source",
          sourceId: "source-github-unavailable",
          code: "github_http_404",
          message: "GitHub repository could not be resolved as a supported public repository.",
          retryable: false,
          occurredAt: createdAt,
        },
      }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "repository_unavailable",
        message: "GitHub repository could not be resolved as a supported public repository.",
        retryable: false,
        requirementIds: ["FR-003", "FR-004"],
        providerFailureCode: "github_http_404",
      },
      progress: [
        {
          phase: "repository",
          status: "started",
        },
        {
          phase: "repository",
          status: "failed",
          failed: 1,
        },
      ],
    });
    expect(npmRegistryProvider.fetchMock).not.toHaveBeenCalled();
    expect(osvProvider.fetchMock).not.toHaveBeenCalled();
  });

  it("fails safely when the resolved repository has no root package.json", async () => {
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () => repositorySuccess(),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected missing repository manifest to fail");
    }

    expect(result.error).toEqual({
      code: "missing_manifest",
      message: "Repository analysis requires a supported root package.json.",
      retryable: false,
      requirementIds: ["FR-003", "FR-004"],
    });
    expect(npmRegistryProvider.fetchMock).not.toHaveBeenCalled();
    expect(osvProvider.fetchMock).not.toHaveBeenCalled();
  });

  it("fails safely on malformed repository package.json without exposing its content", async () => {
    const malformedManifest = '{"dependencies":{"react":';
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () => repositorySuccess({ manifest: malformedManifest }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(malformedManifest);
    expect(npmRegistryProvider.fetchMock).not.toHaveBeenCalled();
    expect(osvProvider.fetchMock).not.toHaveBeenCalled();

    if (result.ok) {
      throw new Error("Expected malformed repository manifest to fail");
    }

    expect(result.error.code).toBe("invalid_manifest");
  });
});

describe("repository metadata resource bounds [NFR-003, SEC-003, SEC-007]", () => {
  it("caps npm metadata enrichment at 100 unique packages and makes affected scores N/A", async () => {
    const dependencies = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [
        `pkg-${index.toString().padStart(3, "0")}`,
        "1.0.0",
      ]),
    );
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () =>
        repositorySuccess({
          manifest: JSON.stringify({ dependencies }),
          sourceContent: "export const value = 1;",
        }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected bounded repository analysis to succeed");
    }

    expect(npmRegistryProvider.fetchMock).toHaveBeenCalledTimes(100);
    expect(npmRegistryProvider.fetchMock).not.toHaveBeenCalledWith({
      packageName: "pkg-100",
    });
    expect(osvProvider.fetchMock).toHaveBeenCalledOnce();
    expect(osvProvider.fetchMock.mock.calls[0]?.[0].queries).toHaveLength(100);
    expect(result.report.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: REPOSITORY_METADATA_LIMITATION_ID,
          kind: "resource_limit",
          affectedCategories: ["dependencies", "security"],
        }),
      ]),
    );
    expect(result.report.scores.categories.dependencies.status).toBe("insufficient_evidence");
    expect(result.report.scores.categories.security.status).toBe("insufficient_evidence");
    expect(result.report.scores.overall.status).toBe("insufficient_evidence");
  });

  it("caps OSV acquisition at 100 exact package-version queries and discloses the gap", async () => {
    const packageNames = Array.from(
      { length: 51 },
      (_, index) => `pkg-${index.toString().padStart(3, "0")}`,
    );
    const dependencies = Object.fromEntries(packageNames.map((name) => [name, "1.0.0"]));
    const devDependencies = Object.fromEntries(packageNames.map((name) => [name, "2.0.0"]));
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () =>
        repositorySuccess({
          manifest: JSON.stringify({ dependencies, devDependencies }),
          sourceContent: "export const value = 1;",
        }),
    );
    const npmRegistryProvider = provider<NpmPackageMetadataRequest, NpmPackageMetadata>(
      "npm-registry",
      async ({ packageName }) => npmSuccess(packageName, "1.0.0", "2.0.0"),
    );
    const osvProvider = provider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>(
      "osv",
      async (request) => osvSuccess(request),
    );

    const result = await analyzePublicGitHubRepository(baseCommand, {
      githubRepositoryProvider,
      npmRegistryProvider,
      osvProvider,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected OSV-bounded repository analysis to succeed");
    }

    expect(npmRegistryProvider.fetchMock).toHaveBeenCalledTimes(51);
    expect(osvProvider.fetchMock).toHaveBeenCalledOnce();

    const osvRequest = osvProvider.fetchMock.mock.calls[0]?.[0];
    expect(osvRequest?.queries).toHaveLength(100);
    expect(osvRequest?.queries).not.toEqual(
      expect.arrayContaining([
        {
          packageName: "pkg-050",
          version: "1.0.0",
        },
        {
          packageName: "pkg-050",
          version: "2.0.0",
        },
      ]),
    );
    expect(result.report.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: REPOSITORY_OSV_LIMITATION_ID,
          kind: "resource_limit",
          affectedCategories: ["security"],
        }),
      ]),
    );
    expect(result.report.scores.categories.security.status).toBe("insufficient_evidence");
    expect(result.report.scores.overall.status).toBe("insufficient_evidence");
  });
});
