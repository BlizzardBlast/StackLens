import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../repository-analysis/repository-analysis-api.js";
import { RepositoryAnalysisPage } from "../repository-analysis/repository-analysis-page.js";
import { createGitHubConnectionClient, githubConnectionClient } from "./github-connection-api.js";
import { GitHubConnectionControl, sessionQueryKey } from "./github-connection.js";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe("GitHub connection UI [FR-100, SEC-005, SEC-007, NFR-006]", () => {
  it("uses only same-origin cookies/CSRF and submits no owner identity or provider token", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        Response.json({
          enabled: true,
          csrfToken: "a".repeat(43),
          user: { login: "alice", expiresAt: "2026-10-12T08:00:00Z" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ analysisId: "synthetic" }))
      .mockResolvedValueOnce(Response.json({ signedOut: true }));
    const client = createGitHubConnectionClient(fetchImpl);
    const session = await client.session();
    await client.submit("https://github.com/acme/private", session.csrfToken ?? "");
    await client.signOut(session.csrfToken ?? "");
    expect(fetchImpl.mock.calls[1]?.[1]).toMatchObject({
      credentials: "same-origin",
      headers: { "x-stacklens-csrf": "a".repeat(43) },
      body: JSON.stringify({ repositoryUrl: "https://github.com/acme/private" }),
    });
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain("githubId");
    fetchImpl.mockResolvedValueOnce(
      Response.json({ enabled: true, installationUrl: "https://evil.example" }),
    );
    await expect(client.session()).rejects.toThrow("unavailable");
  });
  it("removes private cached analyses after confirmed sign-out", async () => {
    let loggedIn = true;
    vi.spyOn(githubConnectionClient, "session").mockImplementation(async () =>
      loggedIn
        ? {
            enabled: true,
            csrfToken: "a".repeat(43),
            user: { login: "alice", expiresAt: new Date(Date.now() + 3600000).toISOString() },
          }
        : { enabled: true },
    );
    const signOut = vi.spyOn(githubConnectionClient, "signOut").mockImplementation(async () => {
      loggedIn = false;
    });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    cache.setQueryData(["repository-analysis", "synthetic", "a".repeat(43)], { private: true });
    render(
      <QueryClientProvider client={cache}>
        <GitHubConnectionControl />
      </QueryClientProvider>,
    );
    await screen.findByText("alice");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("link", { name: "Connect GitHub for private repositories" });
    expect(signOut).toHaveBeenCalledWith("a".repeat(43));
    expect(cache.getQueriesData({ queryKey: ["repository-analysis"] })).toEqual([]);
    cache.clear();
  });
  it("ends the visible session and clears private cache at its actual expiry", async () => {
    vi.useFakeTimers();
    const clock = Date.parse("2026-10-12T00:00:00Z");
    vi.setSystemTime(clock);
    vi.spyOn(githubConnectionClient, "session").mockResolvedValue({
      enabled: true,
      csrfToken: "a".repeat(43),
      user: { login: "alice", expiresAt: new Date(clock + 2000).toISOString() },
    });
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    cache.setQueryData(["repository-analysis", "synthetic"], { private: true });
    render(
      <QueryClientProvider client={cache}>
        <GitHubConnectionControl />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText("alice")).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByText("alice")).toBeNull();
    expect(cache.getQueriesData({ queryKey: ["repository-analysis"] })).toEqual([]);
    cache.clear();
  });
  it("discards a session response started before successful sign-out [SEC-005]", async () => {
    const oldSession = {
      enabled: true,
      csrfToken: "a".repeat(43),
      user: { login: "alice", expiresAt: new Date(Date.now() + 3600000).toISOString() },
    };
    let finish: ((session: typeof oldSession) => void) | undefined;
    let pendingSignal: AbortSignal | undefined;
    const getSession = vi.spyOn(githubConnectionClient, "session").mockImplementation((signal) => {
      pendingSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    vi.spyOn(githubConnectionClient, "signOut").mockResolvedValue();
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    cache.setQueryData(sessionQueryKey, oldSession);
    cache.setQueryData(["repository-analysis", "private", oldSession.csrfToken], { private: true });
    try {
      render(
        <QueryClientProvider client={cache}>
          <GitHubConnectionControl />
        </QueryClientProvider>,
      );
      await screen.findByText("alice");
      await waitFor(() => expect(getSession).toHaveBeenCalledOnce());
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      await screen.findByRole("link", { name: "Connect GitHub for private repositories" });
      expect(pendingSignal?.aborted).toBe(true);
      await act(async () => {
        finish?.(oldSession);
      });
      await waitFor(() => expect(cache.isFetching({ queryKey: sessionQueryKey })).toBe(0));
      expect(screen.queryByText("alice")).toBeNull();
      expect(cache.getQueryData(sessionQueryKey)).toEqual({ enabled: true });
      expect(cache.getQueriesData({ queryKey: ["repository-analysis"] })).toEqual([]);
    } finally {
      cache.clear();
    }
  });
  it.each(["connection", "private analysis"] as const)(
    "hides expired cached %s on the first render after an unobserved expiry [SEC-005]",
    async (view) => {
      vi.useFakeTimers();
      const clock = Date.parse("2026-10-13T00:00:00Z");
      vi.setSystemTime(clock);
      const session = {
        enabled: true,
        csrfToken: "a".repeat(43),
        user: { login: "alice", expiresAt: new Date(clock + 2000).toISOString() },
      };
      // The normal five-minute GC lifetime retains these entries while the user is on /quick.
      const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      cache.setQueryData(sessionQueryKey, session);
      cache.setQueryData(["repository-analysis", "synthetic-expired", session.csrfToken], {
        access: "connected",
        analysisId: "synthetic-expired",
        repositoryUrl: "https://github.com/acme/private-after-expiry",
        status: "running",
        progressStage: "collecting_metadata",
        createdAt: new Date(clock).toISOString(),
        updatedAt: new Date(clock).toISOString(),
      });
      vi.spyOn(githubConnectionClient, "session").mockImplementation(() => new Promise(() => {}));
      try {
        const initial = render(
          <QueryClientProvider client={cache}>
            <GitHubConnectionControl />
          </QueryClientProvider>,
        );
        expect(screen.getByText("alice")).toBeVisible();
        initial.unmount();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });
        expect(cache.getQueryData(sessionQueryKey)).toEqual(session);
        render(
          <QueryClientProvider client={cache}>
            {view === "connection" ? (
              <GitHubConnectionControl />
            ) : (
              <RepositoryAnalysisPage
                analysisId="synthetic-expired"
                client={{
                  getAnalysis: () => new Promise(() => {}),
                  submitRepository: () => new Promise(() => {}),
                }}
              />
            )}
          </QueryClientProvider>,
        );
        // Assert before running the zero-delay expiry cleanup or completing a session refresh.
        expect(screen.queryByText("alice")).toBeNull();
        expect(screen.queryByText("acme/private-after-expiry")).toBeNull();
        expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
        expect(
          cache.getQueryCache().find({
            queryKey: ["repository-analysis", "synthetic-expired", session.csrfToken],
            exact: true,
          }),
        ).toBeUndefined();
      } finally {
        cache.clear();
      }
    },
  );
});
