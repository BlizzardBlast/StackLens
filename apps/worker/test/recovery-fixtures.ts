import type { RepositoryAnalysisDependencies } from "@stacklens/analysis-orchestration";

export function recoveryProviders(
  signal?: AbortSignal,
): Omit<RepositoryAnalysisDependencies, "onProgress"> {
  return {
    githubRepositoryProvider: {
      id: "github-rest",
      async fetch() {
        if (signal !== undefined) {
          await new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("Fixture interrupted.")), {
              once: true,
            });
          });
        }
        const manifest = '{"name":"recovery-fixture"}';
        return {
          ok: true,
          source: {
            id: "recovery-github",
            provider: "github-rest",
            status: "available",
            retrievedAt: new Date().toISOString(),
          },
          evidence: [],
          partialFailures: [],
          data: {
            repository: {
              provider: "github",
              owner: "acme",
              name: "demo",
              commitSha: "a".repeat(40),
              ref: "main",
            },
            manifest: {
              path: "package.json",
              blobSha: "b".repeat(40),
              byteLength: manifest.length,
              content: manifest,
            },
            files: [],
            sourceCoverage: { status: "complete", candidateFiles: 0, acquiredFiles: 0 },
            limitations: [],
            workspaceDiscoveryComplete: true,
          },
        };
      },
    },
    npmRegistryProvider: {
      id: "npm-registry",
      async fetch() {
        throw new Error("Unexpected fixture npm I/O.");
      },
    },
    osvProvider: {
      id: "osv",
      async fetch() {
        throw new Error("Unexpected fixture OSV I/O.");
      },
    },
  };
}
