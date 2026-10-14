import { ProviderResponseTooLargeError, readBoundedResponseText } from "../http.js";
import { GitHubConfigurationError, GitHubRequestError } from "./errors.js";
import { GITHUB_REST_API_VERSION } from "./types.js";

const GITHUB_ACCEPT = "application/vnd.github+json";

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status >= 500;
}

function operationLabel(operation: string): string {
  switch (operation) {
    case "repository":
      return "repository metadata";
    case "commit":
      return "commit metadata";
    case "tree":
      return "repository tree";
    case "blob":
      return "repository file content";
    default:
      return `repository ${operation}`;
  }
}

function isRateLimitResponse(response: Response): boolean {
  return (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after")))
  );
}

function rateLimitAction(authenticated: boolean): string {
  return authenticated
    ? "The configured GitHub token is also subject to GitHub API rate limits."
    : "Configure STACKLENS_GITHUB_TOKEN for authenticated public-repository requests and a higher rate limit.";
}

function rateLimitMessage(response: Response, operation: string, authenticated: boolean): string {
  const label = operationLabel(operation);
  const action = rateLimitAction(authenticated);
  const retryAfter = response.headers.get("retry-after");

  if (retryAfter !== null && /^\d+$/u.test(retryAfter)) {
    return `GitHub API rate limit reached while fetching ${label}. Retry after ${retryAfter} seconds. ${action}`;
  }

  const reset = response.headers.get("x-ratelimit-reset");

  if (reset !== null && /^\d+$/u.test(reset)) {
    const resetAt = new Date(Number(reset) * 1_000);

    if (!Number.isNaN(resetAt.getTime())) {
      return `GitHub API rate limit reached while fetching ${label}. Retry after ${resetAt.toISOString()}. ${action}`;
    }
  }

  return `GitHub API rate limit reached while fetching ${label}. Retry later. ${action}`;
}

export interface GitHubRequestClientOptions {
  readonly fetchImpl: typeof fetch;
  readonly signal?: AbortSignal;
  readonly authToken?: string | undefined;
  readonly getToken?: (signal: AbortSignal) => Promise<string>;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxRequests: number;
}

export class GitHubRequestClient {
  readonly #fetchImpl: typeof fetch;
  readonly #signal: AbortSignal | undefined;
  readonly #authToken: string | undefined;
  readonly #getToken: ((signal: AbortSignal) => Promise<string>) | undefined;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxRequests: number;
  #requestCount = 0;

  constructor(options: GitHubRequestClientOptions) {
    this.#fetchImpl = options.fetchImpl;
    this.#signal = options.signal;
    this.#authToken = options.authToken;
    this.#getToken = options.getToken;
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
    this.#signal?.throwIfAborted();
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
    const signal =
      this.#signal === undefined
        ? controller.signal
        : AbortSignal.any([this.#signal, controller.signal]);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);

    try {
      const headers: Record<string, string> = {
        accept: GITHUB_ACCEPT,
        "x-github-api-version": GITHUB_REST_API_VERSION,
      };

      let token = this.#authToken;
      if (this.#getToken !== undefined) {
        try {
          token = await tokenForRequest(this.#getToken, signal);
        } catch (error) {
          signal.throwIfAborted();
          if (error instanceof GitHubConfigurationError) throw error;
          throw new GitHubRequestError(
            "github_connection_lookup_failed",
            "Connected GitHub credential lookup is temporarily unavailable.",
            true,
            endpoint,
          );
        }
        if (typeof token !== "string" || token.length > 1_024 || !/^[!-~]+$/u.test(token))
          throw new GitHubConfigurationError("Connected GitHub access is unavailable.");
      }
      if (token !== undefined) {
        headers.authorization = `Bearer ${token}`;
      }

      const response = await this.#fetchImpl(endpoint, {
        method: "GET",
        headers,
        redirect: "error",
        signal,
      });

      if (!response.ok) {
        if (
          this.#getToken !== undefined &&
          (response.status === 401 ||
            response.status === 404 ||
            (response.status === 403 && !isRateLimitResponse(response)))
        )
          throw new GitHubConfigurationError("Connected GitHub access is unavailable.");
        if (isRateLimitResponse(response)) {
          throw new GitHubRequestError(
            `github_${operation}_rate_limited`,
            rateLimitMessage(response, operation, token !== undefined),
            false,
            endpoint,
          );
        }

        throw new GitHubRequestError(
          `github_${operation}_http_${response.status}`,
          `GitHub returned HTTP ${response.status} while fetching ${operationLabel(operation)}.`,
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
          `GitHub returned invalid JSON while fetching ${operationLabel(operation)}.`,
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
          `GitHub response exceeded the configured byte limit while fetching ${operationLabel(operation)}.`,
          false,
          endpoint,
        );
      }

      if (timedOut) {
        throw new GitHubRequestError(
          `github_${operation}_timeout`,
          `GitHub request timed out while fetching ${operationLabel(operation)}.`,
          true,
          endpoint,
        );
      }

      throw new GitHubRequestError(
        `github_${operation}_request_failed`,
        `GitHub request failed while fetching ${operationLabel(operation)}.`,
        true,
        endpoint,
      );
    } finally {
      // Close unread error bodies as well as completed requests; never leave cleanup to GC.
      controller.abort();
      clearTimeout(timeout);
    }
  }
}

async function tokenForRequest(
  getToken: (signal: AbortSignal) => Promise<string>,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  let onAbort: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return getToken(signal);
      }),
      interrupted,
    ]);
  } finally {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  }
}
