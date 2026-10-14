import { describe, expect, it, vi } from "vitest";

import type { GitHubConnectionStore, StoredGitHubConnection } from "@stacklens/persistence";

import {
  GitHubConnectionService,
  connectedGitHubToken,
  readGitHubAuthorizationConfig,
} from "../src/index.js";

const key = "12".repeat(32);
const config = {
  clientId: "Iv1.synthetic",
  clientSecret: "synthetic-client-secret",
  publicOrigin: "https://stacklens.example",
  installationUrl: "https://github.com/apps/stacklens-test/installations/new",
  sessionKey: key,
};
const token = "ghu_syntheticTokenForTestsOnly0123456789";
function harness() {
  let clock = Date.parse("2026-10-12T00:00:00Z");
  const rows = new Map<string, StoredGitHubConnection>();
  const store: GitHubConnectionStore = {
    async save(row) {
      rows.set(row.sessionHash, row);
    },
    async find(id) {
      return rows.get(id);
    },
    async remove(id) {
      rows.delete(id);
    },
    async purgeExpired() {
      return 0;
    },
  };
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    if (
      (input instanceof Request ? input.url : input instanceof URL ? input.href : input) ===
      "https://github.com/login/oauth/access_token"
    )
      return Response.json({
        access_token: token,
        refresh_token: "ghr_discarded",
        token_type: "bearer",
        scope: "",
        expires_in: 28800,
      });
    if (
      (input instanceof Request ? input.url : input instanceof URL ? input.href : input) ===
      "https://api.github.com/user"
    )
      return Response.json({ id: 123, login: "alice" });
    return Response.json({ private: true, owner: { login: "acme" }, name: "demo" });
  });
  const service = new GitHubConnectionService(store, config, fetchImpl, () => clock);
  async function connect() {
    const start = service.begin();
    return service.finish(
      start.stateCookie,
      new URL(start.location).searchParams.get("state") ?? "",
      "one-time-code",
    );
  }
  return {
    service,
    rows,
    store,
    fetchImpl,
    connect,
    now: () => clock,
    advance(ms: number) {
      clock += ms;
    },
  };
}

describe("GitHub App connection [FR-100, SEC-004, SEC-005, SEC-007]", () => {
  it("checks token expiry after lookup and forwards acquisition cancellation [NFR-008]", async () => {
    const h = harness();
    const result = await h.connect();
    const session = await h.service.session(result.cookie);
    const connectionId = session?.connectionId ?? "";
    const controller = new AbortController();
    const clock = vi.spyOn(Date, "now").mockImplementation(h.now);
    const find = vi.spyOn(h.store, "find").mockImplementation(async (id) => {
      h.advance(28_800_000);
      return h.rows.get(id);
    });
    try {
      await expect(
        connectedGitHubToken(h.store, key, "123", connectionId, undefined, controller.signal),
      ).rejects.toThrow("GitHub connection");
      expect(find).toHaveBeenCalledWith(connectionId, controller.signal);
    } finally {
      find.mockRestore();
      clock.mockRestore();
    }
  });
  it("uses PKCE and fixed redirects, stores only a hash and authenticated ciphertext, discards refresh tokens", async () => {
    const h = harness(),
      start = h.service.begin();
    const url = new URL(start.location);
    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("scope")).toBe("offline_access");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${config.publicOrigin}/v1/auth/github/callback`,
    );
    const session = await h.service.finish(
      start.stateCookie,
      url.searchParams.get("state") ?? "",
      "one-time-code",
    );
    const identity = await h.service.session(session.cookie);
    expect(identity?.login).toBe("alice");
    expect(JSON.stringify([...h.rows.values()])).not.toContain(token);
    expect(JSON.stringify([...h.rows.values()])).not.toContain(session.cookie);
    expect(JSON.stringify([...h.rows.values()])).not.toContain("ghr_");
    expect(
      await connectedGitHubToken(h.store, key, "123", identity?.connectionId ?? "", h.now()),
    ).toBe(token);
    const init = h.fetchImpl.mock.calls[0]?.[1];
    expect(init?.redirect).toBe("error");
    expect(
      new URLSearchParams(typeof init?.body === "string" ? init.body : "").get("code_verifier"),
    ).toHaveLength(43);
  });
  it("rejects mismatched, expired or altered state before token exchange", async () => {
    const h = harness(),
      start = h.service.begin(),
      state = new URL(start.location).searchParams.get("state") ?? "";
    await expect(h.service.finish(start.stateCookie, "other", "code")).rejects.toThrow(
      "GitHub connection",
    );
    await expect(h.service.finish(`x${start.stateCookie.slice(1)}`, state, "code")).rejects.toThrow(
      "GitHub connection",
    );
    h.advance(600000);
    await expect(h.service.finish(start.stateCookie, state, "code")).rejects.toThrow(
      "GitHub connection",
    );
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });
  it("requires origin and CSRF, denies another owner, and checks removal and expiry on each Worker read", async () => {
    const h = harness(),
      result = await h.connect(),
      session = await h.service.session(result.cookie);
    expect(session).toBeDefined();
    await expect(
      h.service.authorize(result.cookie, session?.csrfToken ?? "", "https://evil.example"),
    ).rejects.toThrow("GitHub connection");
    await expect(h.service.authorize(result.cookie, "bad", config.publicOrigin)).rejects.toThrow(
      "GitHub connection",
    );
    expect(
      (await h.service.authorize(result.cookie, session?.csrfToken ?? "", config.publicOrigin))
        .githubId,
    ).toBe("123");
    await expect(
      connectedGitHubToken(h.store, key, "456", session?.connectionId ?? "", h.now()),
    ).rejects.toThrow("GitHub connection");
    h.advance(28800000);
    await expect(
      connectedGitHubToken(h.store, key, "123", session?.connectionId ?? "", h.now()),
    ).rejects.toThrow("GitHub connection");
    expect(await h.service.session(result.cookie)).toBeUndefined();
    expect(h.rows.size).toBe(0);
    const fresh = await h.connect(),
      freshSession = await h.service.session(fresh.cookie);
    await h.service.signOut(fresh.cookie);
    await expect(
      connectedGitHubToken(h.store, key, "123", freshSession?.connectionId ?? "", h.now()),
    ).rejects.toThrow("GitHub connection");
  });
  it.each(["githubId", "login", "expiresAt", "sessionHash"] as const)(
    "authenticates stored %s to prevent identity or lifetime tampering",
    async (field) => {
      const h = harness(),
        result = await h.connect();
      const id = (await h.service.session(result.cookie))?.connectionId ?? "",
        row = h.rows.get(id);
      if (row === undefined) throw new Error("Missing fixture");
      h.rows.set(id, { ...row, [field]: field === "expiresAt" ? "2099-01-01T00:00:00Z" : "456" });
      await expect(h.service.session(result.cookie)).rejects.toThrow("GitHub connection");
    },
  );
  it("rejects non-expiring, broad-scope and redirect/provider failure responses without echoing secrets", async () => {
    const h = harness(),
      start = h.service.begin();
    h.fetchImpl.mockResolvedValueOnce(
      Response.json({
        access_token: token,
        token_type: "bearer",
        scope: "repo",
        expires_in: 28800,
      }),
    );
    await expect(
      h.service.finish(
        start.stateCookie,
        new URL(start.location).searchParams.get("state") ?? "",
        "code",
      ),
    ).rejects.toThrow("GitHub connection is unavailable");
    expect(h.rows.size).toBe(0);
    h.fetchImpl.mockResolvedValueOnce(new Response("secret provider body", { status: 403 }));
    await expect(
      h.service.finish(
        start.stateCookie,
        new URL(start.location).searchParams.get("state") ?? "",
        "code",
      ),
    ).rejects.toThrow("GitHub connection is unavailable");
    h.fetchImpl.mockResolvedValueOnce(new Response("x".repeat(262145)));
    await expect(
      h.service.finish(
        start.stateCookie,
        new URL(start.location).searchParams.get("state") ?? "",
        "code",
      ),
    ).rejects.toThrow("GitHub connection");
  });
  it("verifies only fixed GitHub repository identities and fails closed for partial config", async () => {
    const h = harness(),
      result = await h.connect(),
      session = await h.service.session(result.cookie);
    if (session === undefined) throw new Error("Missing fixture");
    expect(await h.service.verifyRepository(session, "https://github.com/acme/demo")).toBe(
      "https://github.com/acme/demo",
    );
    const requests = h.fetchImpl.mock.calls.length;
    await expect(
      h.service.verifyRepository(session, "https://evil.example/acme/demo"),
    ).rejects.toThrow("GitHub connection");
    expect(h.fetchImpl).toHaveBeenCalledTimes(requests);
    h.fetchImpl.mockResolvedValueOnce(
      Response.json({ private: true, name: "wrong", owner: { login: "acme" } }),
    );
    await expect(
      h.service.verifyRepository(session, "https://github.com/acme/demo"),
    ).rejects.toThrow("GitHub connection");
    expect(readGitHubAuthorizationConfig({})).toBeUndefined();
    expect(() => readGitHubAuthorizationConfig({ STACKLENS_GITHUB_CLIENT_ID: "only" })).toThrow(
      "GitHub connection",
    );
  });
});
