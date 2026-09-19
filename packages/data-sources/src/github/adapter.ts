import { IsoDateTimeSchema } from "@stacklens/contracts";
import type {
  AnalysisLimitation,
  AvailableDataSource,
  ExternalEvidence,
  PartialDataSource,
  PartialFailure,
  RepositoryIdentity,
  UnavailableDataSource,
} from "@stacklens/contracts";

import { ProviderResponseTooLargeError, readBoundedResponseText } from "../http.js";
import type { EvidenceProvider, ProviderFailure, ProviderResult } from "../provider.js";
import {
  githubBlobApiUrl,
  githubCommitApiUrl,
  githubCommitTreeUrl,
  githubEvidenceId,
  githubFailureId,
  githubInvalidRequestSourceId,
  githubLimitationId,
  githubRepositoryApiUrl,
  githubRepositorySourceId,
  githubTreeApiUrl,
} from "./ids.js";
import {
  isCanonicalRepositoryPath,
  isIgnoredRepositoryPath,
  isInitialSupportedSnapshotPath,
} from "./selection.js";
import {
  GITHUB_DEFAULT_MAX_FILES,
  GITHUB_DEFAULT_MAX_FILE_BYTES,
  GITHUB_DEFAULT_MAX_REQUESTS,
  GITHUB_DEFAULT_MAX_RESPONSE_BYTES,
  GITHUB_DEFAULT_MAX_TOTAL_FILE_BYTES,
  GITHUB_DEFAULT_TIMEOUT_MS,
  GITHUB_PROVIDER_ID,
  GITHUB_REST_API_VERSION,
} from "./types.js";
import type {
  GitHubAdapterOptions,
  GitHubRepositoryFile,
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
  ParsedGitHubRepositoryUrl,
} from "./types.js";
import { parsePublicGitHubRepositoryUrl } from "./url.js";

const CONTRACT_REFERENCE_MAX_LENGTH = 1_000;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const GITHUB_ACCEPT = "application/vnd.github+json";
const MAX_LIMITATION_PATH_SAMPLES = 5;

class GitHubConfigurationError extends Error {}

class GitHubRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly reference: string,
  ) {
    super(message);
  }
}

interface RepositoryPayload {
  readonly owner: string;
  readonly name: string;
  readonly defaultBranch: string;
}

interface CommitPayload {
  readonly commitSha: string;
  readonly treeSha: string;
}

interface TreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: "blob" | "tree" | "commit";
  readonly sha: string;
  readonly size?: number;
}

interface TreePayload {
  readonly entries: readonly TreeEntry[];
  readonly truncated: boolean;
}

interface BlobPayload {
  readonly sha: string;
  readonly size: number;
  readonly content: string;
}

interface CandidateEntry extends TreeEntry {
  readonly kind: "manifest" | "config";
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GitHubConfigurationError(`${label} must be a positive safe integer`);
  }

  return value;
}

function validateObservedAt(value: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new GitHubConfigurationError(
      "now() must return an ISO 8601 timestamp with an offset",
    );
  }

  return parsed.data;
}

function validateRef(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value.length === 0 ||
    value.length > 500 ||
    value !== value.trim()
  ) {
    return undefined;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return undefined;
    }
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function createUnavailableResult(
  sourceId: string,
  attemptedAt: string,
  code: string,
  message: string,
  retryable: boolean,
  reference?: string,
): ProviderFailure {
  const source: UnavailableDataSource = {
    id: sourceId,
    provider: GITHUB_PROVIDER_ID,
    status: "unavailable",
    attemptedAt,
    ...(reference === undefined ? {} : { reference }),
  };
  const failure: PartialFailure = {
    id: githubFailureId(sourceId, code),
    scope: "source",
    sourceId,
    code,
    message,
    retryable,
    occurredAt: attemptedAt,
  };

  return {
    ok: false,
    source,
    failure,
  };
}

function createPartialFailure(
  sourceId: string,
  occurredAt: string,
  code: string,
  message: string,
  retryable: boolean,
  context = "",
): PartialFailure {
  return {
    id: githubFailureId(sourceId, code, context),
    scope: "source",
    sourceId,
    code,
    message,
    retryable,
    occurredAt,
  };
}

function createLimitation(
  sourceId: string,
  code: string,
  kind: AnalysisLimitation["kind"],
  message: string,
): AnalysisLimitation {
  return {
    id: githubLimitationId(sourceId, code),
    kind,
    message: message.slice(0, 4_000),
    affectedCategories: ["dependencies", "maintainability", "testing", "tooling"],
    sourceIds: [sourceId],
    ruleIds: [],
  };
}

function samplePaths(paths: readonly string[]): string {
  const sorted = [...paths].toSorted(compareCodeUnits);
  const samples = sorted.slice(0, MAX_LIMITATION_PATH_SAMPLES).map((path) => JSON.stringify(path));
  const suffix =
    sorted.length > samples.length ? ` (+${sorted.length - samples.length} more)` : "";
  return `${samples.join(", ")}${suffix}`;
}

function parseRepositoryPayload(value: unknown, expected: ParsedGitHubRepositoryUrl): RepositoryPayload {
  if (!isRecord(value) || typeof value.private !== "boolean" || typeof value.name !== "string") {
    throw new TypeError("invalid repository payload");
  }

  if (value.private) {
    throw new GitHubRequestError(
      "github_private_repository_unsupported",
      `GitHub repository ${expected.owner}/${expected.name} is private; MVP acquisition supports public repositories only.`,
      false,
      expected.canonicalUrl,
    );
  }

  const owner = value.owner;

  if (
    !isRecord(owner) ||
    typeof owner.login !== "string" ||
    typeof value.default_branch !== "string" ||
    value.default_branch.length === 0
  ) {
    throw new TypeError("invalid repository payload");
  }

  if (
    owner.login.toLowerCase() !== expected.owner.toLowerCase() ||
    value.name.toLowerCase() !== expected.name.toLowerCase()
  ) {
    throw new GitHubRequestError(
      "github_repository_identity_mismatch",
      `GitHub returned a repository identity that does not match ${expected.owner}/${expected.name}.`,
      false,
      expected.canonicalUrl,
    );
  }

  return {
    owner: owner.login,
    name: value.name,
    defaultBranch: value.default_branch,
  };
}

function parseCommitPayload(value: unknown): CommitPayload {
  if (
    !isRecord(value) ||
    typeof value.sha !== "string" ||
    !SHA_PATTERN.test(value.sha) ||
    !isRecord(value.commit) ||
    !isRecord(value.commit.tree) ||
    typeof value.commit.tree.sha !== "string" ||
    !SHA_PATTERN.test(value.commit.tree.sha)
  ) {
    throw new TypeError("invalid commit payload");
  }

  return {
    commitSha: value.sha.toLowerCase(),
    treeSha: value.commit.tree.sha.toLowerCase(),
  };
}

function parseTreePayload(value: unknown): TreePayload {
  if (!isRecord(value) || !Array.isArray(value.tree) || typeof value.truncated !== "boolean") {
    throw new TypeError("invalid tree payload");
  }

  const entries: TreeEntry[] = [];

  for (const item of value.tree) {
    if (
      !isRecord(item) ||
      typeof item.path !== "string" ||
      typeof item.mode !== "string" ||
      typeof item.type !== "string" ||
      !["blob", "tree", "commit"].includes(item.type) ||
      typeof item.sha !== "string" ||
      !SHA_PATTERN.test(item.sha) ||
      (item.size !== undefined &&
        (!Number.isSafeInteger(item.size) || (item.size as number) < 0))
    ) {
      throw new TypeError("invalid tree payload");
    }

    entries.push({
      path: item.path,
      mode: item.mode,
      type: item.type as TreeEntry["type"],
      sha: item.sha.toLowerCase(),
      ...(item.size === undefined ? {} : { size: item.size as number }),
    });
  }

  return {
    entries,
    truncated: value.truncated,
  };
}

function parseBlobPayload(value: unknown, expectedSha: string): BlobPayload {
  if (
    !isRecord(value) ||
    typeof value.sha !== "string" ||
    value.sha.toLowerCase() !== expectedSha.toLowerCase() ||
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    value.encoding !== "base64" ||
    typeof value.content !== "string"
  ) {
    throw new TypeError("invalid blob payload");
  }

  return {
    sha: value.sha.toLowerCase(),
    size: value.size,
    content: value.content,
  };
}

function decodeBlobText(payload: BlobPayload): { readonly text: string; readonly byteLength: number } {
  let binary: string;

  try {
    binary = globalThis.atob(payload.content.replace(/\s+/g, ""));
  } catch {
    throw new TypeError("invalid base64 blob payload");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  if (bytes.byteLength !== payload.size) {
    throw new TypeError("blob size mismatch");
  }

  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GitHubRequestError(
      "github_binary_file_skipped",
      "GitHub returned non-UTF-8 content for a selected repository file.",
      false,
      "",
    );
  }

  if (text.includes("\0")) {
    throw new GitHubRequestError(
      "github_binary_file_skipped",
      "GitHub returned binary content for a selected repository file.",
      false,
      "",
    );
  }

  return {
    text,
    byteLength: bytes.byteLength,
  };
}

function candidateOrder(left: CandidateEntry, right: CandidateEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === "manifest" ? -1 : 1;
  }

  return compareCodeUnits(left.path, right.path);
}

export class GitHubRepositoryAdapter implements EvidenceProvider<
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot
> {
  readonly id = GITHUB_PROVIDER_ID;

  readonly #fetchImpl: typeof fetch;
  readonly #now: () => string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxFileBytes: number;
  readonly #maxTotalFileBytes: number;
  readonly #maxFiles: number;
  readonly #maxRequests: number;

  constructor(options: GitHubAdapterOptions = {}) {
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch;
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
    this.#maxFiles = validatePositiveInteger(options.maxFiles ?? GITHUB_DEFAULT_MAX_FILES, "maxFiles");
    this.#maxRequests = validatePositiveInteger(
      options.maxRequests ?? GITHUB_DEFAULT_MAX_REQUESTS,
      "maxRequests",
    );

    if (this.#maxRequests < 3) {
      throw new GitHubConfigurationError("maxRequests must allow repository, commit, and tree requests");
    }
  }

  async fetch(
    request: GitHubRepositoryRequest,
  ): Promise<ProviderResult<GitHubRepositorySnapshot>> {
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

    const requestedRef = validateRef(request.ref);

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

    let requestCount = 0;

    const requestJson = async (
      endpoint: string,
      operation: string,
    ): Promise<unknown> => {
      if (requestCount >= this.#maxRequests) {
        throw new GitHubRequestError(
          "github_request_limit_reached",
          `GitHub repository acquisition reached the configured ${this.#maxRequests}-request limit.`,
          false,
          endpoint,
        );
      }

      requestCount += 1;
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.#timeoutMs);

      try {
        const response = await this.#fetchImpl(endpoint, {
          method: "GET",
          headers: {
            accept: GITHUB_ACCEPT,
            "x-github-api-version": GITHUB_REST_API_VERSION,
          },
          redirect: "error",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new GitHubRequestError(
            `github_${operation}_http_${response.status}`,
            `GitHub returned HTTP ${response.status} during repository ${operation}.`,
            isRetryableStatus(response.status),
            endpoint,
          );
        }

        const body = await readBoundedResponseText(response, this.#maxResponseBytes, () => {
          controller.abort();
        });

        try {
          return JSON.parse(body) as unknown;
        } catch {
          throw new GitHubRequestError(
            `github_${operation}_invalid_json`,
            `GitHub returned invalid JSON during repository ${operation}.`,
            false,
            endpoint,
          );
        }
      } catch (error) {
        if (error instanceof GitHubConfigurationError || error instanceof GitHubRequestError) {
          throw error;
        }

        if (error instanceof ProviderResponseTooLargeError) {
          throw new GitHubRequestError(
            `github_${operation}_response_too_large`,
            `GitHub response exceeded the configured byte limit during repository ${operation}.`,
            false,
            endpoint,
          );
        }

        if (timedOut) {
          throw new GitHubRequestError(
            `github_${operation}_timeout`,
            `GitHub repository ${operation} timed out.`,
            true,
            endpoint,
          );
        }

        throw new GitHubRequestError(
          `github_${operation}_request_failed`,
          `GitHub repository ${operation} request failed.`,
          true,
          endpoint,
        );
      } finally {
        clearTimeout(timeout);
      }
    };

    let repository: RepositoryPayload;
    const repositoryEndpoint = githubRepositoryApiUrl(
      parsedRepository.owner,
      parsedRepository.name,
    );

    try {
      const payload = await requestJson(repositoryEndpoint, "repository");

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
        failure.reference.length <= CONTRACT_REFERENCE_MAX_LENGTH
          ? failure.reference
          : parsedRepository.canonicalUrl,
      );
    }

    const resolvedRef = requestedRef ?? repository.defaultBranch;
    const commitEndpoint = githubCommitApiUrl(repository.owner, repository.name, resolvedRef);
    let commit: CommitPayload;

    try {
      const payload = await requestJson(commitEndpoint, "commit");

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
        failure.reference.length <= CONTRACT_REFERENCE_MAX_LENGTH
          ? failure.reference
          : parsedRepository.canonicalUrl,
      );
    }

    const sourceId = githubRepositorySourceId(repository.owner, repository.name, commit.commitSha);
    const sourceReference = githubCommitTreeUrl(
      repository.owner,
      repository.name,
      commit.commitSha,
    );
    const treeEndpoint = githubTreeApiUrl(repository.owner, repository.name, commit.treeSha);
    let tree: TreePayload;

    try {
      const payload = await requestJson(treeEndpoint, "tree");

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

      const supported = isInitialSupportedSnapshotPath(entry.path);

      if (!supported) {
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
        kind: entry.path === "package.json" ? "manifest" : "config",
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

    for (const entry of retainedCandidates) {
      if (entry.size !== undefined && entry.size > this.#maxFileBytes) {
        oversizedPaths.push(entry.path);
        continue;
      }

      if (
        entry.size !== undefined &&
        totalBytes + entry.size > this.#maxTotalFileBytes
      ) {
        aggregateLimitedPaths.push(entry.path);
        continue;
      }

      if (requestCount >= this.#maxRequests) {
        aggregateLimitedPaths.push(entry.path);
        continue;
      }

      const endpoint = githubBlobApiUrl(repository.owner, repository.name, entry.sha);

      try {
        const payload = await requestJson(endpoint, "blob");
        let blob: BlobPayload;

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
          continue;
        }

        let decoded: { readonly text: string; readonly byteLength: number };

        try {
          decoded = decodeBlobText(blob);
        } catch (error) {
          if (error instanceof GitHubRequestError && error.code === "github_binary_file_skipped") {
            binaryPaths.push(entry.path);
            continue;
          }

          throw error;
        }

        if (totalBytes + decoded.byteLength > this.#maxTotalFileBytes) {
          aggregateLimitedPaths.push(entry.path);
          continue;
        }

        if (decoded.text.startsWith("version https://git-lfs.github.com/spec/v1\n")) {
          lfsPointerPaths.push(entry.path);
          continue;
        }

        const file: GitHubRepositoryFile = {
          path: entry.path,
          blobSha: blob.sha,
          byteLength: decoded.byteLength,
          content: decoded.text,
        };

        totalBytes += decoded.byteLength;

        if (entry.kind === "manifest") {
          manifest = file;
        } else {
          files.push(file);
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
    }

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
        limitations,
      },
      source,
      evidence: [evidence],
      partialFailures,
    };
  }
}
