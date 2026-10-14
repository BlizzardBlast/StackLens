import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@stacklens/ui/components/button";

import { githubConnectionClient, type GitHubSessionView } from "./github-connection-api.js";

export const sessionQueryKey = ["github-session"] as const;

function usableSession(session: GitHubSessionView): GitHubSessionView {
  if (session.user === undefined || Date.parse(session.user.expiresAt) > Date.now()) return session;
  return {
    enabled: session.enabled,
    ...(session.installationUrl === undefined ? {} : { installationUrl: session.installationUrl }),
  };
}

export function useGitHubSession() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: async ({ signal }) => {
      return usableSession(await githubConnectionClient.session(signal));
    },
    retry: false,
    refetchInterval: 60_000,
    staleTime: 0,
  });
  const deadline = query.data?.user?.expiresAt;
  useEffect(() => {
    if (deadline === undefined) return undefined;
    const expire = () => {
      cache.setQueryData<GitHubSessionView>(sessionQueryKey, {
        enabled: query.data?.enabled ?? false,
        ...(query.data?.installationUrl === undefined
          ? {}
          : { installationUrl: query.data.installationUrl }),
      });
      void cache
        .cancelQueries({ queryKey: ["repository-analysis"] })
        .then(() => cache.removeQueries({ queryKey: ["repository-analysis"] }));
    };
    const timer = setTimeout(expire, Math.max(0, Date.parse(deadline) - Date.now()));
    return () => clearTimeout(timer);
  }, [cache, deadline, query.data?.enabled, query.data?.installationUrl]);
  return {
    ...query,
    // Cached data can outlive its expiry while this hook has no mounted observers. Hide it
    // on the first render; the expiry effect still owns asynchronous cache cleanup.
    session: query.isError || query.data === undefined ? undefined : usableSession(query.data),
  };
}

export function GitHubConnectionControl() {
  const { session, isError } = useGitHubSession();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function signOut() {
    if (session?.csrfToken === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      await githubConnectionClient.signOut(session.csrfToken);
      await cache.cancelQueries({ queryKey: sessionQueryKey });
      await cache.cancelQueries({ queryKey: ["repository-analysis"] });
      cache.removeQueries({ queryKey: ["repository-analysis"] });
      cache.setQueryData<GitHubSessionView>(sessionQueryKey, {
        enabled: true,
        ...(session.installationUrl === undefined
          ? {}
          : { installationUrl: session.installationUrl }),
      });
    } catch {
      setError("Sign-out could not be confirmed. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }
  if (session?.enabled !== true)
    return isError ? (
      <output className="text-sm text-muted-foreground">
        GitHub connection is temporarily unavailable. Anonymous analysis is still available.
      </output>
    ) : null;
  return (
    <section aria-label="GitHub connection" className="grid gap-3 border-t pt-4 text-sm">
      {session.user === undefined ? (
        <a
          href="/v1/auth/github/start"
          className="font-semibold text-primary underline underline-offset-4"
        >
          Connect GitHub for private repositories
        </a>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Connected as <strong>{session.user.login}</strong>
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </Button>
        </div>
      )}
      {session.installationUrl === undefined ? null : (
        <a
          href={session.installationUrl}
          className="text-primary underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          Choose repositories on GitHub
        </a>
      )}
      <p className="text-muted-foreground">
        Grant read access only to repositories you choose. Private results stay with your account.
        Dependency names and exact versions may be sent to npm and OSV; source code is transient and
        never executed.
      </p>
      {error === undefined ? null : (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
