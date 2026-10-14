import { createHash } from "node:crypto";

import type { GitHubConnectionStore, StoredGitHubConnection } from "@stacklens/persistence";

import {
  connectionKey,
  csrfToken,
  digest,
  equalSecret,
  GitHubConnectionError,
  randomSecret,
  seal,
  unseal,
} from "./crypto.js";
import {
  callbackUrl,
  exchangeGitHubCode,
  getGitHubIdentity,
  validateAuthorizationConfig,
  verifyGitHubRepository,
  type GitHubAuthorizationConfig,
} from "./github.js";

export interface GitHubSession {
  readonly githubId: string;
  readonly login: string;
  readonly connectionId: string;
  readonly expiresAt: string;
  readonly csrfToken: string;
}

function tokenBinding(
  record: Pick<StoredGitHubConnection, "sessionHash" | "githubId" | "login" | "expiresAt">,
): string {
  return `token:${record.sessionHash}:${record.githubId}:${record.login}:${record.expiresAt}`;
}

export class GitHubConnectionService {
  readonly #key: Buffer;
  constructor(
    readonly store: GitHubConnectionStore,
    readonly config: GitHubAuthorizationConfig,
    readonly fetchImpl: typeof fetch = fetch,
    readonly now: () => number = Date.now,
  ) {
    validateAuthorizationConfig(config);
    this.#key = connectionKey(config.sessionKey);
  }

  begin(): { location: string; stateCookie: string } {
    const state = randomSecret(),
      verifier = randomSecret();
    const stateCookie = seal(
      JSON.stringify({ state, verifier, expiresAt: this.now() + 600_000 }),
      this.#key,
      "oauth",
    );
    const query = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: callbackUrl(this.config),
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      scope: "offline_access",
      allow_signup: "false",
    });
    return { location: `https://github.com/login/oauth/authorize?${query}`, stateCookie };
  }

  async finish(
    stateCookie: string,
    state: string,
    code: string,
  ): Promise<{ cookie: string; expiresAt: string }> {
    let pending: unknown;
    try {
      pending = JSON.parse(unseal(stateCookie, this.#key, "oauth"));
    } catch {
      throw new GitHubConnectionError();
    }
    if (
      typeof pending !== "object" ||
      pending === null ||
      !("state" in pending) ||
      typeof pending.state !== "string" ||
      !("verifier" in pending) ||
      typeof pending.verifier !== "string" ||
      !("expiresAt" in pending) ||
      typeof pending.expiresAt !== "number" ||
      pending.expiresAt <= this.now() ||
      !equalSecret(pending.state, state)
    )
      throw new GitHubConnectionError();
    const startedAt = this.now();
    const result = await exchangeGitHubCode(this.config, code, pending.verifier, this.fetchImpl);
    const identity = await getGitHubIdentity(result.token, this.fetchImpl);
    const expiresAt = new Date(startedAt + result.lifetimeSeconds * 1_000).toISOString();
    if (Date.parse(expiresAt) <= this.now()) throw new GitHubConnectionError();
    const cookie = randomSecret(),
      sessionHash = digest(cookie);
    const identityRecord = { sessionHash, githubId: identity.id, login: identity.login, expiresAt };
    await this.store.save({
      ...identityRecord,
      sealedToken: seal(result.token, this.#key, tokenBinding(identityRecord)),
    });
    return { cookie, expiresAt };
  }

  async #record(cookie: string): Promise<StoredGitHubConnection | undefined> {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(cookie)) return undefined;
    const record = await this.store.find(digest(cookie));
    if (
      record !== undefined &&
      (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= this.now())
    ) {
      await this.store.remove(record.sessionHash);
      return undefined;
    }
    if (record !== undefined) unseal(record.sealedToken, this.#key, tokenBinding(record));
    return record;
  }

  async session(cookie: string): Promise<GitHubSession | undefined> {
    const record = await this.#record(cookie);
    return record === undefined
      ? undefined
      : {
          githubId: record.githubId,
          login: record.login,
          connectionId: record.sessionHash,
          expiresAt: record.expiresAt,
          csrfToken: csrfToken(cookie, this.#key),
        };
  }

  async authorize(
    cookie: string,
    token: string,
    origin: string | undefined,
  ): Promise<GitHubSession> {
    const session = await this.session(cookie);
    if (
      session === undefined ||
      origin !== this.config.publicOrigin ||
      !equalSecret(session.csrfToken, token)
    )
      throw new GitHubConnectionError();
    return session;
  }

  async signOut(cookie: string): Promise<void> {
    await this.store.remove(digest(cookie));
  }

  async verifyRepository(session: GitHubSession, repositoryUrl: string): Promise<string> {
    return verifyGitHubRepository(
      repositoryUrl,
      await this.token(session.githubId, session.connectionId),
      this.fetchImpl,
    );
  }

  async token(githubId: string, connectionId: string): Promise<string> {
    const record = await this.store.find(connectionId);
    if (
      record === undefined ||
      record.githubId !== githubId ||
      !Number.isFinite(Date.parse(record.expiresAt)) ||
      Date.parse(record.expiresAt) <= this.now()
    ) {
      if (record !== undefined && Date.parse(record.expiresAt) <= this.now())
        await this.store.remove(connectionId);
      throw new GitHubConnectionError();
    }
    return unseal(record.sealedToken, this.#key, tokenBinding(record));
  }
}

/** Worker needs the data key, never the OAuth app client secret. */
export async function connectedGitHubToken(
  store: GitHubConnectionStore,
  key: string,
  githubId: string,
  connectionId: string,
  now?: number,
  signal?: AbortSignal,
): Promise<string> {
  const record = await store.find(connectionId, signal);
  const observedAt = now ?? Date.now();
  if (
    record === undefined ||
    record.githubId !== githubId ||
    !Number.isFinite(Date.parse(record.expiresAt)) ||
    Date.parse(record.expiresAt) <= observedAt
  )
    throw new GitHubConnectionError();
  return unseal(record.sealedToken, connectionKey(key), tokenBinding(record));
}

export function readGitHubAuthorizationConfig(
  environment: Readonly<Record<string, string | undefined>>,
): GitHubAuthorizationConfig | undefined {
  const names = [
    "STACKLENS_GITHUB_CLIENT_ID",
    "STACKLENS_GITHUB_CLIENT_SECRET",
    "STACKLENS_PUBLIC_ORIGIN",
    "STACKLENS_GITHUB_INSTALLATION_URL",
    "STACKLENS_GITHUB_SESSION_KEY",
  ] as const;
  if (names.every((name) => !environment[name])) return undefined;
  if (names.some((name) => !environment[name])) throw new GitHubConnectionError();
  const config = {
    clientId: environment.STACKLENS_GITHUB_CLIENT_ID!,
    clientSecret: environment.STACKLENS_GITHUB_CLIENT_SECRET!,
    publicOrigin: environment.STACKLENS_PUBLIC_ORIGIN!,
    installationUrl: environment.STACKLENS_GITHUB_INSTALLATION_URL!,
    sessionKey: environment.STACKLENS_GITHUB_SESSION_KEY!,
  };
  validateAuthorizationConfig(config);
  connectionKey(config.sessionKey);
  return config;
}
