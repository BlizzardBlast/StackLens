import type { RepositoryAnalysisDependencies } from "@stacklens/analysis-orchestration";
import type { GitHubAdapterOptions } from "@stacklens/data-sources";
import {
  GitHubRepositoryAdapter,
  GitHubConfigurationError,
  NpmRegistryAdapter,
  OsvVulnerabilityAdapter,
  type EvidenceProvider,
} from "@stacklens/data-sources";
import { GitHubConnectionError } from "@stacklens/github-auth";

/** NFR-008/009: cancellation belongs to the executing job, not shared providers. */
export function createWorkerAnalysisDependencies(
  signal: AbortSignal,
  githubToken?: string,
  fetchImpl: typeof fetch = fetch,
  authorizedAccess?: GitHubAdapterOptions["authorizedAccess"],
): Omit<RepositoryAnalysisDependencies, "onProgress"> {
  const fetchForJob: typeof fetch = (input, init) => {
    signal.throwIfAborted();
    return fetchImpl(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
    });
  };

  function cancellable<TRequest, TData>(
    provider: EvidenceProvider<TRequest, TData>,
  ): EvidenceProvider<TRequest, TData> {
    return {
      id: provider.id,
      async fetch(request) {
        signal.throwIfAborted();
        const result = await provider.fetch(request);
        // An adapter can represent interrupted I/O as partial provider data. Never report that
        // as a successful analysis when the executing job has been cancelled.
        signal.throwIfAborted();
        return result;
      },
    };
  }

  const npm = cancellable(new NpmRegistryAdapter({ fetchImpl: fetchForJob }));
  let pendingNpm: Promise<unknown> = Promise.resolve();

  return {
    githubRepositoryProvider: cancellable({
      id: "github-rest",
      async fetch(request) {
        try {
          return await new GitHubRepositoryAdapter({
            authToken: githubToken,
            fetchImpl: fetchForJob,
            signal,
            ...(authorizedAccess === undefined
              ? {}
              : {
                  authorizedAccess: {
                    repositoryUrl: authorizedAccess.repositoryUrl,
                    async getToken(lookupSignal) {
                      try {
                        return await authorizedAccess.getToken(lookupSignal);
                      } catch (error) {
                        if (error instanceof GitHubConnectionError)
                          throw new GitHubConfigurationError(
                            "Connected GitHub access is unavailable.",
                          );
                        throw error;
                      }
                    },
                  },
                }),
          }).fetch(request);
        } catch (error) {
          if (authorizedAccess !== undefined && error instanceof GitHubConfigurationError)
            throw new GitHubConnectionError();
          throw error;
        }
      },
    }),
    npmRegistryProvider: {
      id: npm.id,
      fetch(request) {
        // Full npm packuments can each approach the 16 MiB response bound. Serialize their
        // acquisition per job without changing selection, result ordering or analyzer policy.
        const result = pendingNpm.then(() => npm.fetch(request));
        pendingNpm = result.catch(() => undefined);
        return result;
      },
    },
    osvProvider: cancellable(new OsvVulnerabilityAdapter({ fetchImpl: fetchForJob })),
  };
}
