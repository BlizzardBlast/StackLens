import type { AnalysisLimitation, RepositoryIdentity } from "@stacklens/contracts";

export const GITHUB_PROVIDER_ID = "github-rest";
export const GITHUB_API_BASE_URL = "https://api.github.com/";
export const GITHUB_WEB_BASE_URL = "https://github.com/";
export const GITHUB_REST_API_VERSION = "2026-03-10";

export const GITHUB_DEFAULT_TIMEOUT_MS = 8_000;
export const GITHUB_DEFAULT_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
export const GITHUB_DEFAULT_MAX_FILE_BYTES = 512 * 1024;
export const GITHUB_DEFAULT_MAX_TOTAL_FILE_BYTES = 2 * 1024 * 1024;
export const GITHUB_DEFAULT_MAX_FILES = 32;
export const GITHUB_DEFAULT_MAX_REQUESTS = 40;

export interface ParsedGitHubRepositoryUrl {
  readonly owner: string;
  readonly name: string;
  readonly canonicalUrl: string;
}

export interface GitHubRepositoryRequest {
  readonly repositoryUrl: string;
  readonly ref?: string;
}

export interface GitHubRepositoryFile {
  readonly path: string;
  readonly blobSha: string;
  readonly byteLength: number;
  readonly content: string;
}

export interface GitHubSourceCoverage {
  readonly status: "complete" | "partial";
  readonly candidateFiles: number;
  readonly acquiredFiles: number;
}

export interface GitHubRepositorySnapshot {
  readonly repository: RepositoryIdentity;
  readonly manifest?: GitHubRepositoryFile;
  readonly files: readonly GitHubRepositoryFile[];
  readonly sourceCoverage: GitHubSourceCoverage;
  readonly limitations: readonly AnalysisLimitation[];
}

export interface GitHubAdapterOptions {
  readonly fetchImpl?: typeof fetch;
  readonly authToken?: string | undefined;
  readonly now?: () => string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly maxFileBytes?: number;
  readonly maxTotalFileBytes?: number;
  readonly maxFiles?: number;
  readonly maxRequests?: number;
}
