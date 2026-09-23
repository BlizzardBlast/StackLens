import type {
  AnalysisLimitation,
  AvailableDataSource,
  ExternalEvidence,
  PartialDataSource,
  PartialFailure,
  RepositoryIdentity,
} from "@stacklens/contracts";

import type { EvidenceProvider, ProviderResult } from "../provider.js";
import {
  GitHubBinaryContentError,
  GitHubConfigurationError,
  GitHubRequestError,
} from "./errors.js";
import {
  githubBlobApiUrl,
  githubCommitApiUrl,
  githubCommitTreeUrl,
  githubEvidenceId,
  githubInvalidRequestSourceId,
  githubRepositoryApiUrl,
  githubRepositorySourceId,
  githubTreeApiUrl,
} from "./ids.js";
import {
  decodeBlobText,
  parseBlobPayload,
  parseCommitPayload,
  parseRepositoryPayload,
  parseTreePayload,
} from "./metadata.js";
import type { RepositoryPayload, TreeEntry } from "./metadata.js";
import { GitHubRequestClient } from "./request.js";
import {
  createLimitation,
  createPartialFailure,
  createUnavailableResult,
  samplePaths,
} from "./result.js";
import {
  isCanonicalRepositoryPath,
  isIgnoredRepositoryPath,
  isInitialSupportedSnapshotPath,
  isSupportedDependencyLockfilePath,
  isSupportedJavaScriptSourcePath,
  isUnsupportedSourceUsagePath,
} from "./selection.js";
import {
  GITHUB_DEFAULT_MAX_FILES,
  GITHUB_DEFAULT_MAX_FILE_BYTES,
  GITHUB_DEFAULT_MAX_REQUESTS,
  GITHUB_DEFAULT_MAX_RESPONSE_BYTES,
  GITHUB_DEFAULT_MAX_TOTAL_FILE_BYTES,
  GITHUB_DEFAULT_TIMEOUT_MS,
  GITHUB_PROVIDER_ID,
} from "./types.js";
import type {
  GitHubAdapterOptions,
  GitHubRepositoryFile,
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
} from "./types.js";
import { parsePublicGitHubRepositoryUrl } from "./url.js";
import { validateGitHubRef, validateObservedAt, validatePositiveInteger } from "./validation.js";

const CONTRACT_REFERENCE_MAX_LENGTH = 1_000;

interface CandidateEntry extends TreeEntry {
  readonly kind: "manifest" | "lockfile" | "config" | "source";
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function candidateRank(kind: CandidateEntry["kind"]): number {
  if (kind === "manifest") {
    return 0;
  }

  if (kind === "lockfile") {
    return 1;
  }

  return kind === "config" ? 2 : 3;
}

function candidateOrder(left: CandidateEntry, right: CandidateEntry): number {
  const rankOrder = candidateRank(left.kind) - candidateRank(right.kind);
  return rankOrder === 0 ? compareCodeUnits(left.path, right.path) : rankOrder;
}

function safeFailureReference(reference: string, fallback: string): string {
  return reference.length <= CONTRACT_REFERENCE_MAX_LENGTH ? reference : fallback;
}

function usageEvidencePathWasAffected(paths: readonly string[]): boolean {
  return paths.some(
    (path) =>
      path !== "package.json" &&
      !isSupportedDependencyLockfilePath(path) &&
      isInitialSupportedSnapshotPath(path),
  );
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);

    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) {
      return true;
    }
  }

  return false;
}

function validateAuthToken(authToken: string | undefined): string | undefined {
  if (authToken === undefined) {
    return undefined;
  }

  if (authToken.length === 0 || authToken.trim() !== authToken || hasControlCharacter(authToken)) {
    throw new GitHubConfigurationError(
      "authToken must be a non-empty trimmed string without control characters",
    );
  }

  return authToken;
}

export class GitHubRepositoryAdapter implements EvidenceProvider<
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot
> {
  readonly id = GITHUB_PROVIDER_ID;

  readonly #fetchImpl: typeof fetch;
  readonly #authToken: string | undefined;
  readonly #now: () => string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxFileBytes: number;
  readonly #maxTotalFileBytes: number;
  readonly #maxFiles: number;
  readonly #maxRequests: number;

  constructor(options: GitHubAdapterOptions = {}) {
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.#authToken = validateAuthToken(options.authToken);
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#timeoutMs = validatePositiveInteger(
      options.timeoutMs ?? GITHUB_DEFAULT_TIMEOUT_MS,
      "timeoutMs",
    );
    this.#maxResponseBytes = validatePositiveInteger(
      options.maxResponseBytes ?? GITHUB_DEFAULT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
    );
    this.#maxFileBytes = validatePositiveInteger(
      options.maxFileBytes ?? GITHUB_DEFAULT_MAX_FILE_BYTES,
      "maxFileBytes",
    );
    this.#maxTotalFileBytes = validatePositiveInteger(
      options.maxTotalFileBytes ?? GITHUB_DEFAULT_MAX_TOTAL_FILE_BYTES,
      "maxTotalFileBytes",
    );
    this.#maxFiles = validatePositiveInteger(
      options.maxFiles ?? GITHUB_DEFAULT_MAX_FILES,
      "maxFiles",
    );
    this.#maxRequests = validatePositiveInteger(
      options.maxRequests ?? GITHUB_DEFAULT_MAX_REQUESTS,
      "maxRequests",
    );

    if (this.#maxRequests < 3) {
      throw new GitHubConfigurationError(
        "maxRequests must allow repository, commit, and tree requests",
      );
    }
  }

  async fetch(request: GitHubRepositoryRequest): Promise<ProviderResult<GitHubRepositorySnapshot>> {
    const parsedRepository = parsePublicGitHubRepositoryUrl(request.repositoryUrl);
    const requestKey = JSON.stringify([request.repositoryUrl, request.ref ?? null]);

    if (parsedRepository === undefined) {
      return createUnavailableResult(
        githubInvalidRequestSourceId(requestKey),
        validateObservedAt(this.#now()),
        "github_invalid_repository_url",
        "Repository URL must be an HTTPS github.com/<owner>/<repository> URL without credentials, query parameters, fragments, or extra path segments.",
        false,
      );
    }

    const requestedRef = validateGitHubRef(request.ref);

    if (request.ref !== undefined && requestedRef === undefined) {
      return createUnavailableResult(
        githubInvalidRequestSourceId(requestKey),
        validateObservedAt(this.#now()),
        "github_invalid_ref",
        "GitHub repository refs must be non-empty, trimmed strings of at most 500 characters without control characters.",
        false,
        parsedRepository.canonicalUrl,
      );
    }

    const client = new GitHubRequestClient({
      fetchImpl: this.#fetchImpl,
      authToken: this.#authToken,
      timeoutMs: this.#timeoutMs,
      maxResponseBytes: this.#maxResponseBytes,
      maxRequests: this.#maxRequests,
    });

    const repositoryEndpoint = githubRepositoryApiUrl(
      parsedRepository.owner,
      parsedRepository.name,
    );
    let repository: RepositoryPayload;

    try {
      const payload = await client.getJson(repositoryEndpoint, "repository");

      try {
        repository = parseRepositoryPayload(payload, parsedRepository);
      } catch (error) {
        if (error instanceof GitHubRequestError) {
          throw error;
        }

        throw new GitHubRequestError(
          "github_invalid_repository_response",
          `GitHub returned an unsupported repository metadata shape for ${parsedRepository.owner}/${parsedRepository.name}.`,
          false,
          repositoryEndpoint,
        );
      }
    } catch (error) {
      if (error instanceof GitHubConfigurationError) {
        throw error;
      }

      const failure =
        error instanceof GitHubRequestError
          ? error
          : new GitHubRequestError(
              "github_repository_request_failed",
              "GitHub repository metadata request failed.",
              true,
              repositoryEndpoint,
            );

      return createUnavailableResult(
        githubInvalidRequestSourceId(requestKey),
        validateObservedAt(this.#now()),
        failure.code,
        failure.message,
        failure.retryable,
        safeFailureReference(failure.reference, parsedRepository.canonicalUrl),
      );
    }

    const resolvedRef = requestedRef ?? repository.defaultBranch;
    const commitEndpoint = githubCommitApiUrl(repository.owner, repository.name, resolvedRef);
    let commit;

    try {
      const payload = await client.getJson(commitEndpoint, "commit");

      try {
        commit = parseCommitPayload(payload);
      } catch {
        throw new GitHubRequestError(
          "github_invalid_commit_response",
          `GitHub returned an unsupported commit shape for ref ${JSON.stringify(resolvedRef)}.`,
          false,
          commitEndpoint,
        );
      }
    } catch (error) {
      if (error instanceof GitHubConfigurationError) {
        throw error;
      }

      const failure =
        error instanceof GitHubRequestError
          ? error
          : new GitHubRequestError(
              "github_commit_request_failed",
              "GitHub commit resolution request failed.",
              true,
              commitEndpoint,
            );

      return createUnavailableResult(
        githubInvalidRequestSourceId(requestKey),
        validateObservedAt(this.#now()),
        failure.code,
        failure.message,
        failure.retryable,
        safeFailureReference(failure.reference, parsedRepository.canonicalUrl),
      );
    }

    const sourceId = githubRepositorySourceId(repository.owner, repository.name, commit.commitSha);
    const sourceReference = githubCommitTreeUrl(
      repository.owner,
      repository.name,
      commit.commitSha,
    );
    const treeEndpoint = githubTreeApiUrl(repository.owner, repository.name, commit.treeSha);
    let tree;

    try {
      const payload = await client.getJson(treeEndpoint, "tree");

      try {
        tree = parseTreePayload(payload);
      } catch {
        throw new GitHubRequestError(
          "github_invalid_tree_response",
          "GitHub returned an unsupported repository tree shape.",
          false,
          treeEndpoint,
        );
      }
    } catch (error) {
      if (error instanceof GitHubConfigurationError) {
        throw error;
      }

      const failure =
        error instanceof GitHubRequestError
          ? error
          : new GitHubRequestError(
              "github_tree_request_failed",
              "GitHub repository tree request failed.",
              true,
              treeEndpoint,
            );

      return createUnavailableResult(
        sourceId,
        validateObservedAt(this.#now()),
        failure.code,
        failure.message,
        failure.retryable,
        sourceReference,
      );
    }

    const limitations: AnalysisLimitation[] = [];
    const partialFailures: PartialFailure[] = [];
    const unsafePaths: string[] = [];
    const ignoredSupportedPaths: string[] = [];
    const symlinkPaths: string[] = [];
    const submodulePaths: string[] = [];
    const unsupportedSourcePaths: string[] = [];
    const candidates: CandidateEntry[] = [];

    for (const entry of tree.entries) {
      if (!isCanonicalRepositoryPath(entry.path)) {
        unsafePaths.push(entry.path);
        continue;
      }

      if (entry.type === "commit") {
        submodulePaths.push(entry.path);
        continue;
      }

      if (isUnsupportedSourceUsagePath(entry.path)) {
        if (!isIgnoredRepositoryPath(entry.path)) {
          unsupportedSourcePaths.push(entry.path);
        }
        continue;
      }

      if (!isInitialSupportedSnapshotPath(entry.path)) {
        continue;
      }

      if (isIgnoredRepositoryPath(entry.path)) {
        ignoredSupportedPaths.push(entry.path);
        continue;
      }

      if (entry.type !== "blob") {
        continue;
      }

      if (entry.mode === "120000") {
        symlinkPaths.push(entry.path);
        continue;
      }

      candidates.push({
        ...entry,
        kind:
          entry.path === "package.json"
            ? "manifest"
            : isSupportedDependencyLockfilePath(entry.path)
              ? "lockfile"
              : isSupportedJavaScriptSourcePath(entry.path)
                ? "source"
                : "config",
      });
    }

    if (tree.truncated) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_tree_truncated",
          "resource_limit",
          "GitHub returned a truncated recursive repository tree; supported files outside the returned tree may be unavailable.",
        ),
      );
      partialFailures.push(
        createPartialFailure(
          sourceId,
          validateObservedAt(this.#now()),
          "github_tree_truncated",
          "GitHub recursive tree enumeration was truncated.",
          false,
        ),
      );
    }

    if (unsafePaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_unsafe_paths_skipped",
          "partial_failure",
          `Repository entries with unsafe/non-canonical paths were skipped: ${samplePaths(unsafePaths)}.`,
        ),
      );
    }

    if (ignoredSupportedPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_generated_vendor_paths_skipped",
          "partial_failure",
          `Recognized analysis files under generated/vendor directories were skipped: ${samplePaths(
            ignoredSupportedPaths,
          )}.`,
        ),
      );
    }

    if (unsupportedSourcePaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_unsupported_source_formats",
          "insufficient_evidence",
          `Repository source files with unsupported first-slice formats were not analyzed: ${samplePaths(
            unsupportedSourcePaths,
          )}.`,
        ),
      );
    }

    if (symlinkPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_symlinks_skipped",
          "partial_failure",
          `Selected repository symlinks were not followed: ${samplePaths(symlinkPaths)}.`,
        ),
      );
    }

    if (submodulePaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_submodules_not_traversed",
          "partial_failure",
          `Repository submodules were recorded but not traversed: ${samplePaths(submodulePaths)}.`,
        ),
      );
    }

    const orderedCandidates = candidates.toSorted(candidateOrder);
    const retainedCandidates = orderedCandidates.slice(0, this.#maxFiles);
    const sourceCandidateCount = candidates.filter(
      (candidate) => candidate.kind === "source",
    ).length;
    if (orderedCandidates.length > retainedCandidates.length) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_file_count_limit",
          "resource_limit",
          `Repository acquisition retained at most ${this.#maxFiles} supported files and skipped ${orderedCandidates.length - retainedCandidates.length} additional supported file(s).`,
        ),
      );
    }

    const files: GitHubRepositoryFile[] = [];
    let manifest: GitHubRepositoryFile | undefined;
    let totalBytes = 0;
    const oversizedPaths: string[] = [];
    const aggregateLimitedPaths: string[] = [];
    const binaryPaths: string[] = [];
    const lfsPointerPaths: string[] = [];
    const failedPaths: string[] = [];

    const acquireEntry = async (entry: CandidateEntry): Promise<void> => {
      if (entry.size !== undefined && entry.size > this.#maxFileBytes) {
        oversizedPaths.push(entry.path);
        return;
      }

      if (entry.size !== undefined && totalBytes + entry.size > this.#maxTotalFileBytes) {
        aggregateLimitedPaths.push(entry.path);
        return;
      }

      if (client.requestCount >= client.maxRequests) {
        aggregateLimitedPaths.push(entry.path);
        return;
      }

      const endpoint = githubBlobApiUrl(repository.owner, repository.name, entry.sha);

      try {
        const payload = await client.getJson(endpoint, "blob");
        let blob;

        try {
          blob = parseBlobPayload(payload, entry.sha);
        } catch {
          throw new GitHubRequestError(
            "github_invalid_blob_response",
            `GitHub returned an unsupported blob shape for ${JSON.stringify(entry.path)}.`,
            false,
            endpoint,
          );
        }

        if (blob.size > this.#maxFileBytes) {
          oversizedPaths.push(entry.path);
          return;
        }

        let decoded;

        try {
          decoded = decodeBlobText(blob);
        } catch (error) {
          if (error instanceof GitHubBinaryContentError) {
            binaryPaths.push(entry.path);
            return;
          }

          throw new GitHubRequestError(
            "github_invalid_blob_response",
            `GitHub returned an unsupported blob payload for ${JSON.stringify(entry.path)}.`,
            false,
            endpoint,
          );
        }

        if (totalBytes + decoded.byteLength > this.#maxTotalFileBytes) {
          aggregateLimitedPaths.push(entry.path);
          return;
        }

        if (decoded.text.startsWith("version https://git-lfs.github.com/spec/v1\n")) {
          lfsPointerPaths.push(entry.path);
          return;
        }

        const acquiredFile: GitHubRepositoryFile = {
          path: entry.path,
          blobSha: blob.sha,
          byteLength: decoded.byteLength,
          content: decoded.text,
        };
        totalBytes += decoded.byteLength;

        if (entry.kind === "manifest") {
          manifest = acquiredFile;
        } else {
          files.push(acquiredFile);
        }
      } catch (error) {
        if (error instanceof GitHubConfigurationError) {
          throw error;
        }

        const failure =
          error instanceof GitHubRequestError
            ? error
            : new GitHubRequestError(
                "github_blob_request_failed",
                `GitHub blob request failed for ${JSON.stringify(entry.path)}.`,
                true,
                endpoint,
              );

        failedPaths.push(entry.path);
        partialFailures.push(
          createPartialFailure(
            sourceId,
            validateObservedAt(this.#now()),
            failure.code,
            `GitHub could not acquire selected file ${JSON.stringify(entry.path)}.`,
            failure.retryable,
            entry.path,
          ),
        );
      }
    };

    const acquireSequentially = async (index: number): Promise<void> => {
      const entry = retainedCandidates[index];

      if (entry === undefined) {
        return;
      }

      await acquireEntry(entry);
      return acquireSequentially(index + 1);
    };

    await acquireSequentially(0);

    if (oversizedPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_file_size_limit",
          "resource_limit",
          `Selected repository files exceeding the ${this.#maxFileBytes}-byte per-file limit were skipped: ${samplePaths(
            oversizedPaths,
          )}.`,
        ),
      );
    }

    if (aggregateLimitedPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_total_or_request_limit",
          "resource_limit",
          `Selected repository files could not be retained within the ${this.#maxTotalFileBytes}-byte aggregate/${this.#maxRequests}-request acquisition bounds: ${samplePaths(
            aggregateLimitedPaths,
          )}.`,
        ),
      );
    }

    if (binaryPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_binary_files_skipped",
          "partial_failure",
          `Selected repository files with non-text/binary content were skipped: ${samplePaths(binaryPaths)}.`,
        ),
      );
    }

    if (lfsPointerPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_lfs_files_not_followed",
          "partial_failure",
          `Git LFS pointer files were not dereferenced: ${samplePaths(lfsPointerPaths)}.`,
        ),
      );
    }

    if (failedPaths.length > 0) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_selected_file_failures",
          "partial_failure",
          `Some selected repository files could not be acquired: ${samplePaths(failedPaths)}.`,
        ),
      );
    }

    if (manifest === undefined) {
      limitations.push(
        createLimitation(
          sourceId,
          "github_root_manifest_missing",
          "insufficient_evidence",
          "Repository acquisition did not obtain a supported root package.json, so JavaScript/TypeScript manifest-dependent analysis is unavailable.",
        ),
      );
    }

    const acquiredSourceCount = files.filter((file) =>
      isSupportedJavaScriptSourcePath(file.path),
    ).length;
    const sourceCoveragePartial =
      tree.truncated ||
      unsafePaths.length > 0 ||
      retainedCandidates.length < orderedCandidates.length ||
      ignoredSupportedPaths.length > 0 ||
      unsupportedSourcePaths.length > 0 ||
      submodulePaths.length > 0 ||
      usageEvidencePathWasAffected(symlinkPaths) ||
      usageEvidencePathWasAffected(oversizedPaths) ||
      usageEvidencePathWasAffected(aggregateLimitedPaths) ||
      usageEvidencePathWasAffected(binaryPaths) ||
      usageEvidencePathWasAffected(lfsPointerPaths) ||
      usageEvidencePathWasAffected(failedPaths);

    const retrievedAt = validateObservedAt(this.#now());
    const partial = limitations.length > 0 || partialFailures.length > 0;
    const source: AvailableDataSource | PartialDataSource = {
      id: sourceId,
      provider: GITHUB_PROVIDER_ID,
      status: partial ? "partial" : "available",
      retrievedAt,
      reference: sourceReference,
    };
    const evidence: ExternalEvidence = {
      id: githubEvidenceId(sourceId),
      kind: "external",
      sourceId,
      summary: `GitHub repository snapshot for ${repository.owner}/${repository.name} at commit ${commit.commitSha}`,
      reference: sourceReference,
      url: sourceReference,
    };
    const repositoryIdentity: RepositoryIdentity = {
      provider: "github",
      owner: repository.owner,
      name: repository.name,
      commitSha: commit.commitSha,
      ref: resolvedRef,
    };

    return {
      ok: true,
      data: {
        repository: repositoryIdentity,
        ...(manifest === undefined ? {} : { manifest }),
        files: files.toSorted((left, right) => compareCodeUnits(left.path, right.path)),
        sourceCoverage: {
          status: sourceCoveragePartial ? "partial" : "complete",
          candidateFiles: sourceCandidateCount,
          acquiredFiles: acquiredSourceCount,
        },
        limitations,
      },
      source,
      evidence: [evidence],
      partialFailures,
    };
  }
}
