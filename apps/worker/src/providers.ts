import type { RepositoryAnalysisDependencies } from "@stacklens/analysis-orchestration";
import {
  GitHubRepositoryAdapter,
  NpmRegistryAdapter,
  OsvVulnerabilityAdapter,
  type EvidenceProvider,
} from "@stacklens/data-sources";

/** NFR-008/009: cancellation belongs to the executing job, not shared providers. */
export function createWorkerAnalysisDependencies(
  signal: AbortSignal,
  githubToken?: string,
  fetchImpl: typeof fetch = fetch,
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
    githubRepositoryProvider: cancellable(
      new GitHubRepositoryAdapter({ authToken: githubToken, fetchImpl: fetchForJob }),
    ),
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
