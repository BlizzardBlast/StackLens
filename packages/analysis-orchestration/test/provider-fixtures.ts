import { vi } from "vitest";

import type { AvailableDataSource, ExternalEvidence, PartialFailure } from "@stacklens/contracts";
import type {
  EvidenceProvider,
  GitHubRepositorySnapshot,
  NpmPackageMetadata,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
  ProviderResult,
} from "@stacklens/data-sources";
export const createdAt = "2026-09-20T01:30:00Z";
export const commitSha = "a".repeat(40);

interface TestProvider<TRequest, TData> extends EvidenceProvider<TRequest, TData> {
  readonly fetchMock: ReturnType<
    typeof vi.fn<(request: TRequest) => Promise<ProviderResult<TData>>>
  >;
}

export function provider<TRequest, TData>(
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

export function availableSource(
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

export function externalEvidence(
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

export function repositorySuccess(
  options: {
    readonly manifest?: string;
    readonly sourceContent?: string;
    readonly lockfile?: {
      readonly path: "package-lock.json" | "pnpm-lock.yaml" | "yarn.lock";
      readonly content: string;
    };
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
      files: [
        ...(options.lockfile === undefined
          ? []
          : [
              {
                path: options.lockfile.path,
                blobSha: "d".repeat(40),
                byteLength: options.lockfile.content.length,
                content: options.lockfile.content,
              },
            ]),
        ...(options.sourceContent === undefined
          ? []
          : [
              {
                path: "src/index.ts",
                blobSha: "c".repeat(40),
                byteLength: options.sourceContent.length,
                content: options.sourceContent,
              },
            ]),
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

export function npmSuccess(
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

export function npmFailure(packageName: string): ProviderResult<NpmPackageMetadata> {
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

export function osvSuccess(
  request: OsvVulnerabilityRequest,
): ProviderResult<OsvVulnerabilitySnapshot> {
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
