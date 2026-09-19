import { ProviderResponseTooLargeError, readBoundedResponseText } from "../http.js";
import { GitHubConfigurationError, GitHubRequestError } from "./errors.js";
import { GITHUB_REST_API_VERSION } from "./types.js";

const GITHUB_ACCEPT = "application/vnd.github+json";

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export interface GitHubRequestClientOptions {
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxRequests: number;
}

export class GitHubRequestClient {
  readonly #fetchImpl: typeof fetch;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxRequests: number;
  #requestCount = 0;

  constructor(options: GitHubRequestClientOptions) {
    this.#fetchImpl = options.fetchImpl;
    this.#timeoutMs = options.timeoutMs;
    this.#maxResponseBytes = options.maxResponseBytes;
    this.#maxRequests = options.maxRequests;
  }

  get requestCount(): number {
    return this.#requestCount;
  }

  get maxRequests(): number {
    return this.#maxRequests;
  }

  async getJson(endpoint: string, operation: string): Promise<unknown> {
    if (this.#requestCount >= this.#maxRequests) {
      throw new GitHubRequestError(
        "github_request_limit_reached",
        `GitHub repository acquisition reached the configured ${this.#maxRequests}-request limit.`,
        false,
        endpoint,
      );
    }

    this.#requestCount += 1;
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
  }
}
