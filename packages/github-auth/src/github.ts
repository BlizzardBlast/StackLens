import {
  GITHUB_REST_API_VERSION,
  githubRepositoryApiUrl,
  parsePublicGitHubRepositoryUrl,
} from "@stacklens/data-sources";

import { GitHubConnectionError } from "./crypto.js";

export interface GitHubAuthorizationConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly publicOrigin: string;
  readonly installationUrl: string;
  readonly sessionKey: string;
}

/** SEC-007: response bodies, redirects and low-level errors never escape this boundary. */
async function boundedJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || response.body === null) throw new GitHubConnectionError();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        // oxlint-disable-next-line no-await-in-loop -- Stream byte bounds must be checked before the next read.
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 256 * 1024) {
          controller.abort();
          throw new GitHubConnectionError();
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new GitHubConnectionError();
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new GitHubConnectionError();
  return Object.fromEntries(Object.entries(value));
}

export function validateAuthorizationConfig(config: GitHubAuthorizationConfig): void {
  const origin = new URL(config.publicOrigin);
  if (
    origin.origin !== config.publicOrigin ||
    origin.username ||
    origin.password ||
    !(
      origin.protocol === "https:" ||
      (origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))
    )
  )
    throw new GitHubConnectionError();
  if (
    !/^[A-Za-z0-9_.-]{1,100}$/u.test(config.clientId) ||
    config.clientSecret.length < 16 ||
    /[\r\n]/u.test(config.clientSecret)
  )
    throw new GitHubConnectionError();
  if (
    !/^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new$/u.test(config.installationUrl)
  )
    throw new GitHubConnectionError();
}

export function callbackUrl(config: GitHubAuthorizationConfig): string {
  return `${config.publicOrigin}/v1/auth/github/callback`;
}

export async function exchangeGitHubCode(
  config: GitHubAuthorizationConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch,
): Promise<{ token: string; lifetimeSeconds: number }> {
  if (!/^[A-Za-z0-9_-]{1,256}$/u.test(code)) throw new GitHubConnectionError();
  const body = object(
    await boundedJson(fetchImpl, "https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: callbackUrl(config),
        code_verifier: verifier,
      }).toString(),
    }),
  );
  if (
    typeof body.access_token !== "string" ||
    !/^ghu_[A-Za-z0-9_]{16,512}$/u.test(body.access_token) ||
    body.token_type !== "bearer" ||
    body.scope !== "" ||
    typeof body.expires_in !== "number" ||
    !Number.isSafeInteger(body.expires_in) ||
    body.expires_in <= 0 ||
    body.expires_in > 28_800
  )
    throw new GitHubConnectionError();
  // A refresh token, when present, is intentionally discarded.
  return { token: body.access_token, lifetimeSeconds: body.expires_in };
}

async function getGitHub(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<Record<string, unknown>> {
  return object(
    await boundedJson(fetchImpl, url, {
      method: "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": GITHUB_REST_API_VERSION,
      },
    }),
  );
}

export async function getGitHubIdentity(
  token: string,
  fetchImpl: typeof fetch,
): Promise<{ id: string; login: string }> {
  const user = await getGitHub("https://api.github.com/user", token, fetchImpl);
  if (
    typeof user.id !== "number" ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0 ||
    typeof user.login !== "string" ||
    !/^[A-Za-z0-9-]{1,39}$/u.test(user.login)
  )
    throw new GitHubConnectionError();
  return { id: String(user.id), login: user.login };
}

export async function verifyGitHubRepository(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const repository = parsePublicGitHubRepositoryUrl(url);
  if (repository === undefined) throw new GitHubConnectionError();
  const body = await getGitHub(
    githubRepositoryApiUrl(repository.owner, repository.name),
    token,
    fetchImpl,
  );
  const owner = object(body.owner);
  if (
    typeof body.private !== "boolean" ||
    typeof body.name !== "string" ||
    typeof owner.login !== "string" ||
    body.name.toLowerCase() !== repository.name.toLowerCase() ||
    owner.login.toLowerCase() !== repository.owner.toLowerCase()
  )
    throw new GitHubConnectionError();
  return repository.canonicalUrl;
}
