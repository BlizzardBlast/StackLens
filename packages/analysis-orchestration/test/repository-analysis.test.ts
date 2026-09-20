import { describe, expect, it, vi } from "vitest";

import { AnalysisReportSchema } from "@stacklens/contracts";
import type { AvailableDataSource, ExternalEvidence, PartialFailure } from "@stacklens/contracts";
import type {
  EvidenceProvider,
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
  NpmPackageMetadata,
  NpmPackageMetadataRequest,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
  ProviderResult,
} from "@stacklens/data-sources";

import {
  analyzePublicGitHubRepository,
  REPOSITORY_METADATA_LIMITATION_ID,
  REPOSITORY_OSV_LIMITATION_ID,
} from "../src/index.js";

const createdAt = "2026-09-20T01:30:00Z";
const commitSha = "a".repeat(40);

interface TestProvider<TRequest, TData> extends EvidenceProvider<TRequest, TData> {
  readonly fetchMock: ReturnType<
    typeof vi.fn<(request: TRequest) => Promise<ProviderResult<TData>>>
  >;
}

function provider<TRequest, TData>(
  id: string,
  handler: (request: TRequest) => Promise<ProviderResult<TData>>,
): TestProvider<TRequest, TData> {
  const fetchMock = vi.fn<(request: TRequest) => Promise<ProviderResult<TData>>>(handler);

  return {
    id,
    fetch(request) {
      return fetchMock(request);
    },
    fetchMock,
  };
}

function availableSource(
  id: string,
  providerId: string,
  reference: string,
): AvailableDataSource & { readonly reference: string } {
  return {
    id,
    provider: providerId,
    status: "available",
    retrievedAt: createdAt,
    reference,
  };
}

function externalEvidence(
  id: string,
  sourceId: string,
  reference: string,
  url: string,
): ExternalEvidence {
  return {
    id,
    kind: "external",
    sourceId,
    summary: `Synthetic evidence for ${reference}`,
    reference,
    url,
  };
}

function repositorySuccess(
  options: {
    readonly manifest?: string;
    readonly sourceContent?: string;
  } = {},
): ProviderResult<GitHubRepositorySnapshot> {
  const source = availableSource(
    "source-github-demo",
    "github-rest",
    `https://github.com/acme/demo/tree/${commitSha}`,
  );

  return {
    ok: true,
    source,
    evidence: [
      externalEvidence("evidence-github-demo", source.id, source.reference, source.reference),
    ],
    partialFailures: [],
    data: {
      repository: {
        provider: "github",
        owner: "acme",
        name: "demo",
        commitSha,
        ref: "main",
      },
      ...(options.manifest === undefined
        ? {}
        : {
            manifest: {
              path: "package.json",
              blobSha: "b".repeat(40),
              byteLength: options.manifest.length,
              content: options.manifest,
            },
          }),
      files:
        options.sourceContent === undefined
          ? []
          : [
              {
                path: "src/index.ts",
                blobSha: "c".repeat(40),
                byteLength: options.sourceContent.length,
                content: options.sourceContent,
              },
            ],
      sourceCoverage: {
        status: "complete",
        candidateFiles: options.sourceContent === undefined ? 0 : 1,
        acquiredFiles: options.sourceContent === undefined ? 0 : 1,
      },
      limitations: [],
    },
  };
}

function npmSuccess(
  packageName: string,
  currentVersion: string,
  latestVersion = currentVersion,
): ProviderResult<NpmPackageMetadata> {
  const sourceId = `source-npm-${packageName.replaceAll("/", "-")}`;
  const reference = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const versions =
    currentVersion === latestVersion
      ? [{ version: currentVersion }]
      : [{ version: currentVersion }, { version: latestVersion }];

  return {
    ok: true,
    source: availableSource(sourceId, "npm-registry", reference),
    evidence: [
      externalEvidence(
        `evidence-npm-${packageName.replaceAll("/", "-")}`,
        sourceId,
        reference,
        reference,
      ),
    ],
    partialFailures: [],
    data: {
      packageName,
      distTags: [{ tag: "latest", version: latestVersion }],
      versions,
    },
  };
}

function npmFailure(packageName: string): ProviderResult<NpmPackageMetadata> {
  const sourceId = `source-npm-${packageName}`;
  const failure: PartialFailure = {
    id: `failure-npm-${packageName}`,
    scope: "source",
    sourceId,
    code: "npm_request_timeout",
    message: `npm Registry request for ${packageName} timed out.`,
    retryable: true,
    occurredAt: createdAt,
  };

  return {
    ok: false,
    source: {
      id: sourceId,
      provider: "npm-registry",
      status: "unavailable",
      attemptedAt: createdAt,
      reference: `https://registry.npmjs.org/${packageName}`,
    },
    failure,
  };
}

function osvSuccess(request: OsvVulnerabilityRequest): ProviderResult<OsvVulnerabilitySnapshot> {
  const source = availableSource("source-osv-demo", "osv", "https://api.osv.dev/v1/querybatch");

  return {
    ok: true,
    source,
    evidence: request.queries.map((query, index) =>
      externalEvidence(
        `evidence-osv-query-${index}`,
        source.id,
        `npm:${query.packageName}@${query.version}`,
        "https://api.osv.dev/v1/querybatch",
      ),
    ),
    partialFailures: [],
    data: {
      queryResults: request.queries.map((query) => ({
        packageName: query.packageName,
        version: query.version,
        matches: [],
        complete: true,
      })),
      vulnerabilities: [],
    },
  };
}

const baseCommand = {
  analysisId: "analysis-repository-demo",
  createdAt,
  repositoryUrl: "https://github.com/acme/demo",
} as const;

describe("analyzePublicGitHubRepository [FR-003–FR-021, NFR-003, NFR-008, NFR-009]", () => {
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
      version: "javascript-production-v1",
      ruleSetVersion: "javascript-rules-v1",
      scoringVersion: "stack-health-v1",
    });

    const migration = result.report.findings.find(
      (finding) =>
        finding.rule.id === "JS-MIGRATION-014" && finding.subject.name === "legacy-package",
    );
    expect(migration).toMatchObject({
      classification: "heuristic",
      priority: {
        level: "medium",
        rule: {
          id: "JS-PRIORITY-016",
          version: "1",
        },
      },
    });
    expect(result.report.recommendations).toHaveLength(1);
    expect(result.report.recommendations[0]?.findingIds).toContain(migration?.id ?? "");
    expect(result.report.scores.categories.dependencies).toMatchObject({
      status: "available",
      value: 88,
    });
    expect(result.report.scores.categories.security).toEqual({
      status: "available",
      evidenceCoverage: 100,
      value: 100,
      contributionIds: [],
    });
    expect(result.report.scores.overall).toMatchObject({
      status: "available",
      value: 94,
      evidenceCoverage: 40,
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

  it("queries OSV only for exact declared versions and exposes a skipped state when none exist", async () => {
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
        limitation.message.includes("not an exact supported semantic version"),
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
    const peerDependencies = Object.fromEntries(
      Array.from({ length: 101 }, (_, index) => [
        `pkg-${index.toString().padStart(3, "0")}`,
        "1.0.0",
      ]),
    );
    const githubRepositoryProvider = provider<GitHubRepositoryRequest, GitHubRepositorySnapshot>(
      "github-rest",
      async () =>
        repositorySuccess({
          manifest: JSON.stringify({ peerDependencies }),
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
          affectedCategories: ["dependencies", "security", "maintainability"],
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
