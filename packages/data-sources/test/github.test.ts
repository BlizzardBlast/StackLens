import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisLimitationSchema,
  DataSourceSchema,
  EvidenceSchema,
  PartialFailureSchema,
  RepositoryIdentitySchema,
} from "@stacklens/contracts";

import {
  GITHUB_PROVIDER_ID,
  GitHubRepositoryAdapter,
  githubBlobApiUrl,
  githubCommitApiUrl,
  githubCommitTreeUrl,
  githubRepositoryApiUrl,
  githubRepositorySourceId,
  githubTreeApiUrl,
  parsePublicGitHubRepositoryUrl,
} from "../src/index.js";

const observedAt = "2026-09-19T12:00:00Z";
const owner = "StackLensFixture";
const name = "example-repository";
const commitSha = "a".repeat(40);
const treeSha = "b".repeat(40);
const manifestSha = "c".repeat(40);
const tsconfigSha = "d".repeat(40);
const viteSha = "e".repeat(40);
const prettierSha = "f".repeat(40);
const symlinkSha = "1".repeat(40);
const submoduleSha = "2".repeat(40);
const ignoredSha = "3".repeat(40);
const sourceSha = "4".repeat(40);

function createAdapter(
  fetchImpl: typeof fetch,
  options: {
    readonly authToken?: string;
    readonly timeoutMs?: number;
    readonly maxResponseBytes?: number;
    readonly maxFileBytes?: number;
    readonly maxTotalFileBytes?: number;
    readonly maxFiles?: number;
    readonly maxRequests?: number;
  } = {},
) {
  return new GitHubRepositoryAdapter({
    fetchImpl,
    now: () => observedAt,
    ...options,
  });
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function encodeBase64Bytes(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary);
}

function encodeBase64Text(value: string): { readonly content: string; readonly size: number } {
  const bytes = new TextEncoder().encode(value);
  return {
    content: encodeBase64Bytes(bytes),
    size: bytes.byteLength,
  };
}

function repositoryPayload(overrides: Record<string, unknown> = {}) {
  return {
    name,
    private: false,
    default_branch: "main",
    owner: {
      login: owner,
    },
    ...overrides,
  };
}

function commitPayload(overrides: Record<string, unknown> = {}) {
  return {
    sha: commitSha,
    commit: {
      tree: {
        sha: treeSha,
      },
    },
    ...overrides,
  };
}

function treeEntry(
  path: string,
  sha: string,
  size: number | undefined,
  overrides: Record<string, unknown> = {},
) {
  return {
    path,
    mode: "100644",
    type: "blob",
    sha,
    ...(size === undefined ? {} : { size }),
    ...overrides,
  };
}

function treePayload(
  entries: readonly Record<string, unknown>[],
  truncated = false,
): Record<string, unknown> {
  return {
    sha: treeSha,
    truncated,
    tree: entries,
  };
}

function blobPayload(sha: string, text: string) {
  const encoded = encodeBase64Text(text);

  return {
    sha,
    size: encoded.size,
    encoding: "base64",
    content: encoded.content,
  };
}

function successfulBaseFetch(
  tree: Record<string, unknown>,
  blobs: readonly Record<string, unknown>[],
) {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
    .mockResolvedValueOnce(jsonResponse(commitPayload()))
    .mockResolvedValueOnce(jsonResponse(tree));

  for (const blob of blobs) {
    fetchImpl.mockResolvedValueOnce(jsonResponse(blob));
  }

  return fetchImpl;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("parsePublicGitHubRepositoryUrl [FR-003, FR-004, SEC-002]", () => {
  it("accepts canonical public GitHub repository URLs and normalizes clone suffix/trailing slash", () => {
    expect(parsePublicGitHubRepositoryUrl("https://github.com/Owner/repository")).toEqual({
      owner: "Owner",
      name: "repository",
      canonicalUrl: "https://github.com/Owner/repository",
    });
    expect(parsePublicGitHubRepositoryUrl("https://github.com/Owner/repository.git/")).toEqual({
      owner: "Owner",
      name: "repository",
      canonicalUrl: "https://github.com/Owner/repository",
    });
  });

  it.each([
    "http://github.com/owner/repository",
    "https://github.example.com/owner/repository",
    "https://user:token@github.com/owner/repository",
    "https://github.com/owner/repository?ref=main",
    "https://github.com/owner/repository#readme",
    "https://github.com/owner/repository/tree/main",
    " https://github.com/owner/repository",
    "https://github.com/owner/repository ",
  ])("rejects unsupported repository URL %s", (url) => {
    expect(parsePublicGitHubRepositoryUrl(url)).toBeUndefined();
  });
});

describe("GitHubRepositoryAdapter [FR-003, FR-004, FR-013, DATA-001, DATA-002, DATA-006]", () => {
  it("resolves the default branch to an immutable commit and acquires only supported static files", async () => {
    const packageJson = JSON.stringify({
      name: "fixture",
      dependencies: {
        react: "19.0.0",
      },
    });
    const tsconfig = JSON.stringify({
      compilerOptions: {
        strict: true,
      },
    });
    const viteConfig = 'throw new Error("MUST NOT RUN"); export default {};';
    const sourceText = "import React from 'react'; export const value = React.version;";

    const tree = treePayload([
      treeEntry("src/index.ts", sourceSha, sourceText.length),
      treeEntry("vite.config.ts", viteSha, viteConfig.length),
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("tsconfig.json", tsconfigSha, tsconfig.length),
    ]);
    const fetchImpl = successfulBaseFetch(tree, [
      blobPayload(manifestSha, packageJson),
      blobPayload(tsconfigSha, tsconfig),
      blobPayload(sourceSha, sourceText),
      blobPayload(viteSha, viteConfig),
    ]);
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected GitHub acquisition to succeed");
    }

    const sourceId = githubRepositorySourceId(owner, name, commitSha);

    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      githubRepositoryApiUrl(owner, name),
      githubCommitApiUrl(owner, name, "main"),
      githubTreeApiUrl(owner, name, treeSha),
      githubBlobApiUrl(owner, name, manifestSha),
      githubBlobApiUrl(owner, name, tsconfigSha),
      githubBlobApiUrl(owner, name, sourceSha),
      githubBlobApiUrl(owner, name, viteSha),
    ]);

    for (const call of fetchImpl.mock.calls) {
      expect(call[1]).toEqual(
        expect.objectContaining({
          method: "GET",
          redirect: "error",
          headers: {
            accept: "application/vnd.github+json",
            "x-github-api-version": "2026-03-10",
          },
        }),
      );
    }

    expect(result.data.repository).toEqual({
      provider: "github",
      owner,
      name,
      commitSha,
      ref: "main",
    });
    expect(result.data.manifest).toEqual({
      path: "package.json",
      blobSha: manifestSha,
      byteLength: new TextEncoder().encode(packageJson).byteLength,
      content: packageJson,
    });
    expect(result.data.files).toEqual([
      {
        path: "src/index.ts",
        blobSha: sourceSha,
        byteLength: new TextEncoder().encode(sourceText).byteLength,
        content: sourceText,
      },
      {
        path: "tsconfig.json",
        blobSha: tsconfigSha,
        byteLength: new TextEncoder().encode(tsconfig).byteLength,
        content: tsconfig,
      },
      {
        path: "vite.config.ts",
        blobSha: viteSha,
        byteLength: new TextEncoder().encode(viteConfig).byteLength,
        content: viteConfig,
      },
    ]);
    expect(result.data.sourceCoverage).toEqual({
      status: "complete",
      candidateFiles: 2,
      acquiredFiles: 2,
    });
    expect(result.data.limitations).toEqual([]);
    expect(result.partialFailures).toEqual([]);
    expect(result.source).toEqual({
      id: sourceId,
      provider: GITHUB_PROVIDER_ID,
      status: "available",
      retrievedAt: observedAt,
      reference: githubCommitTreeUrl(owner, name, commitSha),
    });
    expect(result.evidence).toEqual([
      {
        id: expect.any(String),
        kind: "external",
        sourceId,
        summary: `GitHub repository snapshot for ${owner}/${name} at commit ${commitSha}`,
        reference: githubCommitTreeUrl(owner, name, commitSha),
        url: githubCommitTreeUrl(owner, name, commitSha),
      },
    ]);
    expect(DataSourceSchema.safeParse(result.source).success).toBe(true);
    expect(EvidenceSchema.safeParse(result.evidence[0]).success).toBe(true);
    expect(RepositoryIdentitySchema.safeParse(result.data.repository).success).toBe(true);
  });

  it("sends a bearer token only when authenticated public access is configured", async () => {
    const packageJson = "{}";
    const tree = treePayload([treeEntry("package.json", manifestSha, packageJson.length)]);
    const fetchImpl = successfulBaseFetch(tree, [blobPayload(manifestSha, packageJson)]);
    const result = await createAdapter(fetchImpl, {
      authToken: "github_pat_example",
    }).fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    for (const call of fetchImpl.mock.calls) {
      expect(call[1]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "Bearer github_pat_example",
          }),
        }),
      );
    }
  });

  it("rejects malformed configured GitHub tokens before making a request", () => {
    const fetchImpl = vi.fn<typeof fetch>();

    expect(() =>
      createAdapter(fetchImpl, {
        authToken: " token-with-whitespace ",
      }),
    ).toThrow("authToken must be a non-empty trimmed string without control characters");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("marks source coverage partial when relevant source evidence is skipped or unsupported", async () => {
    const packageJson = JSON.stringify({
      dependencies: {
        react: "19.0.0",
      },
    });
    const sourceText = "import React from 'react'; export const value = React.version;";
    const generatedSource = "import unused from 'unused';";
    const unsupportedSource = "<script>import hidden from 'hidden-package';</script>";
    const tree = treePayload([
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("src/index.ts", sourceSha, sourceText.length),
      treeEntry("dist/generated.js", ignoredSha, generatedSource.length),
      treeEntry("src/App.vue", viteSha, unsupportedSource.length),
    ]);
    const fetchImpl = successfulBaseFetch(tree, [
      blobPayload(manifestSha, packageJson),
      blobPayload(sourceSha, sourceText),
    ]);
    const result = await createAdapter(fetchImpl).fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected conservative partial source acquisition");
    }

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(result.data.sourceCoverage).toEqual({
      status: "partial",
      candidateFiles: 1,
      acquiredFiles: 1,
    });
    expect(result.source.status).toBe("partial");

    const messages = result.data.limitations.map((limitation) => limitation.message).join("\n");
    expect(messages).toContain("generated/vendor");
    expect(messages).toContain("unsupported first-slice formats");
  });

  it("uses an explicit ref without silently replacing it with the default branch", async () => {
    const packageJson = "{}";
    const tree = treePayload([treeEntry("package.json", manifestSha, packageJson.length)]);
    const fetchImpl = successfulBaseFetch(tree, [blobPayload(manifestSha, packageJson)]);
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}.git`,
      ref: "feature/static-analysis",
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      githubCommitApiUrl(owner, name, "feature/static-analysis"),
    );

    if (!result.ok) {
      throw new Error("Expected explicit-ref acquisition to succeed");
    }

    expect(result.data.repository.ref).toBe("feature/static-analysis");
    expect(result.data.repository.commitSha).toBe(commitSha);
  });

  it("rejects invalid URL/ref inputs before network access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const adapter = createAdapter(fetchImpl);

    const invalidUrl = await adapter.fetch({
      repositoryUrl: "https://example.com/owner/repository",
    });
    const invalidRef = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
      ref: " bad-ref ",
    });

    expect(invalidUrl.ok).toBe(false);
    expect(invalidRef.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();

    if (invalidUrl.ok || invalidRef.ok) {
      throw new Error("Expected invalid input failures");
    }

    expect(invalidUrl.failure.code).toBe("github_invalid_repository_url");
    expect(invalidRef.failure.code).toBe("github_invalid_ref");
    expect(PartialFailureSchema.safeParse(invalidUrl.failure).success).toBe(true);
    expect(PartialFailureSchema.safeParse(invalidRef.failure).success).toBe(true);
  });

  it("rejects private repositories and provider identity drift", async () => {
    const privateAdapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          repositoryPayload({
            private: true,
          }),
        ),
      ),
    );
    const privateResult = await privateAdapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(privateResult.ok).toBe(false);

    if (privateResult.ok) {
      throw new Error("Expected private repository to fail");
    }

    expect(privateResult.failure).toMatchObject({
      code: "github_private_repository_unsupported",
      retryable: false,
    });

    const driftAdapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          repositoryPayload({
            name: "different-repository",
          }),
        ),
      ),
    );
    const driftResult = await driftAdapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(driftResult.ok).toBe(false);

    if (driftResult.ok) {
      throw new Error("Expected repository identity mismatch");
    }

    expect(driftResult.failure.code).toBe("github_repository_identity_mismatch");
  });

  it("marks truncated trees, symlinks, submodules, unsafe paths, and generated/vendor configs as partial without following them", async () => {
    const packageJson = "{}";
    const tree = treePayload(
      [
        treeEntry("package.json", manifestSha, packageJson.length),
        treeEntry("vite.config.ts", symlinkSha, 20, {
          mode: "120000",
        }),
        {
          path: "packages/external",
          mode: "160000",
          type: "commit",
          sha: submoduleSha,
        },
        treeEntry("../tsconfig.json", "4".repeat(40), 2),
        treeEntry("dist/vitest.config.ts", ignoredSha, 2),
      ],
      true,
    );
    const fetchImpl = successfulBaseFetch(tree, [blobPayload(manifestSha, packageJson)]);
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial GitHub acquisition");
    }

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result.source.status).toBe("partial");
    expect(result.data.sourceCoverage.status).toBe("partial");
    expect(result.data.manifest?.content).toBe(packageJson);
    expect(result.data.files).toEqual([]);
    expect(result.data.limitations.map((limitation) => limitation.message).join("\n")).toContain(
      "truncated recursive repository tree",
    );
    expect(result.data.limitations.map((limitation) => limitation.message).join("\n")).toContain(
      "unsafe/non-canonical paths",
    );
    expect(result.data.limitations.map((limitation) => limitation.message).join("\n")).toContain(
      "generated/vendor",
    );
    expect(result.data.limitations.map((limitation) => limitation.message).join("\n")).toContain(
      "symlinks were not followed",
    );
    expect(result.data.limitations.map((limitation) => limitation.message).join("\n")).toContain(
      "submodules were recorded but not traversed",
    );
    expect(result.partialFailures).toEqual([
      expect.objectContaining({
        code: "github_tree_truncated",
        retryable: false,
        sourceId: result.source.id,
      }),
    ]);

    for (const limitation of result.data.limitations) {
      expect(AnalysisLimitationSchema.safeParse(limitation).success).toBe(true);
    }
  });

  it("prioritizes package.json and enforces file-count plus per-file bounds", async () => {
    const packageJson = "{}";
    const smallConfig = "{}";
    const largeConfig = "x".repeat(50);
    const tree = treePayload([
      treeEntry("vite.config.ts", viteSha, smallConfig.length),
      treeEntry("tsconfig.json", tsconfigSha, smallConfig.length),
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry(".prettierrc.json", prettierSha, largeConfig.length),
    ]);
    const fetchImpl = successfulBaseFetch(tree, [
      blobPayload(manifestSha, packageJson),
      blobPayload(tsconfigSha, smallConfig),
    ]);
    const adapter = createAdapter(fetchImpl, {
      maxFiles: 3,
      maxFileBytes: 20,
      maxTotalFileBytes: 10,
      maxRequests: 5,
    });
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected bounded partial acquisition");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.manifest?.content).toBe(packageJson);
    expect(result.data.files).toEqual([
      {
        path: "tsconfig.json",
        blobSha: tsconfigSha,
        byteLength: smallConfig.length,
        content: smallConfig,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const messages = result.data.limitations.map((limitation) => limitation.message).join("\n");
    expect(messages).toContain("retained at most 3 supported files");
  });

  it("enforces aggregate-content and request-count bounds without losing the manifest", async () => {
    const packageJson = "{}";
    const firstConfig = "{}";
    const secondConfig = '{"a":1}';
    const tree = treePayload([
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("tsconfig.json", tsconfigSha, firstConfig.length),
      treeEntry("vite.config.ts", viteSha, secondConfig.length),
    ]);
    const aggregateFetch = successfulBaseFetch(tree, [
      blobPayload(manifestSha, packageJson),
      blobPayload(tsconfigSha, firstConfig),
    ]);
    const aggregateResult = await createAdapter(aggregateFetch, {
      maxTotalFileBytes: 4,
    }).fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(aggregateResult.ok).toBe(true);

    if (!aggregateResult.ok) {
      throw new Error("Expected aggregate-limited acquisition");
    }

    expect(aggregateResult.data.manifest?.content).toBe(packageJson);
    expect(aggregateResult.data.files).toEqual([
      {
        path: "tsconfig.json",
        blobSha: tsconfigSha,
        byteLength: firstConfig.length,
        content: firstConfig,
      },
    ]);
    expect(aggregateResult.data.limitations[0]?.message).toContain(
      "aggregate/40-request acquisition bounds",
    );

    const requestFetch = successfulBaseFetch(tree, [blobPayload(manifestSha, packageJson)]);
    const requestResult = await createAdapter(requestFetch, {
      maxRequests: 4,
    }).fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(requestResult.ok).toBe(true);

    if (!requestResult.ok) {
      throw new Error("Expected request-limited acquisition");
    }

    expect(requestFetch).toHaveBeenCalledTimes(4);
    expect(requestResult.data.manifest?.content).toBe(packageJson);
    expect(requestResult.data.files).toEqual([]);
    expect(requestResult.data.limitations[0]?.message).toContain(
      "aggregate/4-request acquisition bounds",
    );
  });

  it("skips oversized selected files before fetching their blobs", async () => {
    const packageJson = "{}";
    const tree = treePayload([
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("tsconfig.json", tsconfigSha, 100),
    ]);
    const fetchImpl = successfulBaseFetch(tree, [blobPayload(manifestSha, packageJson)]);
    const adapter = createAdapter(fetchImpl, {
      maxFileBytes: 20,
    });
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial oversized-file acquisition");
    }

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result.source.status).toBe("partial");
    expect(result.data.files).toEqual([]);
    expect(result.data.limitations[0]?.message).toContain("20-byte per-file limit");
  });

  it("preserves successful files when a later selected blob fails", async () => {
    const packageJson = "{}";
    const tree = treePayload([
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("vite.config.ts", viteSha, 10),
    ]);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse(commitPayload()))
      .mockResolvedValueOnce(jsonResponse(tree))
      .mockResolvedValueOnce(jsonResponse(blobPayload(manifestSha, packageJson)))
      .mockResolvedValueOnce(jsonResponse({ message: "provider secret body" }, 503));
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial blob failure");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.manifest?.content).toBe(packageJson);
    expect(result.data.files).toEqual([]);
    expect(result.partialFailures).toEqual([
      expect.objectContaining({
        code: "github_blob_http_503",
        retryable: true,
        sourceId: result.source.id,
      }),
    ]);
    expect(JSON.stringify(result.partialFailures)).not.toContain("provider secret body");
    expect(result.data.limitations[0]?.message).toContain("could not be acquired");
  });

  it("skips binary and Git LFS selected content without dereferencing it", async () => {
    const packageJson = "{}";
    const binaryContent = encodeBase64Bytes(new Uint8Array([0xff, 0xfe, 0xfd]));
    const lfsText = "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n";
    const tree = treePayload([
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("tsconfig.json", tsconfigSha, 3),
      treeEntry("vite.config.ts", viteSha, new TextEncoder().encode(lfsText).byteLength),
    ]);
    const fetchImpl = successfulBaseFetch(tree, [
      blobPayload(manifestSha, packageJson),
      {
        sha: tsconfigSha,
        size: 3,
        encoding: "base64",
        content: binaryContent,
      },
      blobPayload(viteSha, lfsText),
    ]);
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial binary/LFS acquisition");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.files).toEqual([]);
    const messages = result.data.limitations.map((limitation) => limitation.message).join("\n");
    expect(messages).toContain("non-text/binary content");
    expect(messages).toContain("Git LFS pointer files were not dereferenced");
  });

  it("returns a partial snapshot when root package.json is not available", async () => {
    const tsconfig = "{}";
    const tree = treePayload([treeEntry("tsconfig.json", tsconfigSha, tsconfig.length)]);
    const fetchImpl = successfulBaseFetch(tree, [blobPayload(tsconfigSha, tsconfig)]);
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial repository snapshot");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.manifest).toBeUndefined();
    expect(result.data.files).toHaveLength(1);
    expect(result.data.limitations[0]?.kind).toBe("insufficient_evidence");
    expect(result.data.limitations[0]?.message).toContain("root package.json");
  });

  it("treats malformed blob payloads as non-retryable provider failures for that file", async () => {
    const packageJson = "{}";
    const tree = treePayload([
      treeEntry("package.json", manifestSha, packageJson.length),
      treeEntry("tsconfig.json", tsconfigSha, 3),
    ]);
    const fetchImpl = successfulBaseFetch(tree, [
      blobPayload(manifestSha, packageJson),
      {
        sha: tsconfigSha,
        size: 3,
        encoding: "base64",
        content: "!!!not-base64!!!",
      },
    ]);
    const adapter = createAdapter(fetchImpl);
    const result = await adapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial invalid-blob acquisition");
    }

    expect(result.partialFailures).toEqual([
      expect.objectContaining({
        code: "github_invalid_blob_response",
        retryable: false,
      }),
    ]);
  });

  it("fails closed on invalid provider metadata/tree shapes", async () => {
    const invalidRepository = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          private: false,
        }),
      ),
    );
    const repositoryResult = await invalidRepository.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(repositoryResult.ok).toBe(false);

    if (repositoryResult.ok) {
      throw new Error("Expected invalid repository response");
    }

    expect(repositoryResult.failure.code).toBe("github_invalid_repository_response");

    const invalidTreeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(repositoryPayload()))
      .mockResolvedValueOnce(jsonResponse(commitPayload()))
      .mockResolvedValueOnce(
        jsonResponse(
          treePayload([
            treeEntry("package.json", manifestSha, 2, {
              mode: "120000",
              type: "tree",
            }),
          ]),
        ),
      );
    const treeResult = await createAdapter(invalidTreeFetch).fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(treeResult.ok).toBe(false);

    if (treeResult.ok) {
      throw new Error("Expected invalid tree response");
    }

    expect(treeResult.failure.code).toBe("github_invalid_tree_response");
  });

  it("classifies GitHub rate limits and forbidden responses without leaking provider details", async () => {
    const primaryReset = String(Date.parse("2026-09-22T16:00:00.000Z") / 1_000);
    const primaryRateLimited = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: "sensitive provider message" }), {
          status: 403,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": primaryReset,
          },
        }),
      ),
    );
    const primaryRateResult = await primaryRateLimited.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(primaryRateResult.ok).toBe(false);

    if (primaryRateResult.ok) {
      throw new Error("Expected primary rate-limit failure");
    }

    expect(primaryRateResult.failure).toMatchObject({
      code: "github_repository_rate_limited",
      retryable: true,
    });
    expect(primaryRateResult.failure.message).toContain("Retry after 2026-09-22T16:00:00.000Z");
    expect(primaryRateResult.failure.message).toContain("STACKLENS_GITHUB_TOKEN");
    expect(primaryRateResult.failure.message).not.toContain("sensitive provider message");

    const secondaryRateLimited = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: "another provider detail" }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "60",
          },
        }),
      ),
    );
    const secondaryRateResult = await secondaryRateLimited.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(secondaryRateResult.ok).toBe(false);

    if (secondaryRateResult.ok) {
      throw new Error("Expected secondary rate-limit failure");
    }

    expect(secondaryRateResult.failure).toMatchObject({
      code: "github_repository_rate_limited",
      retryable: true,
    });
    expect(secondaryRateResult.failure.message).toContain("Retry after 60 seconds");

    const forbidden = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ message: "forbidden detail" }, 403)),
    );
    const forbiddenResult = await forbidden.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(forbiddenResult.ok).toBe(false);

    if (forbiddenResult.ok) {
      throw new Error("Expected forbidden failure");
    }

    expect(forbiddenResult.failure).toMatchObject({
      code: "github_repository_http_403",
      retryable: false,
      message: "GitHub returned HTTP 403 while fetching repository metadata.",
    });
    expect(forbiddenResult.failure.message).not.toContain("forbidden detail");

    const networkFailure = createAdapter(
      vi.fn<typeof fetch>().mockRejectedValue(new Error("socket secret")),
    );
    const networkResult = await networkFailure.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(networkResult.ok).toBe(false);

    if (networkResult.ok) {
      throw new Error("Expected network failure");
    }

    expect(networkResult.failure).toMatchObject({
      code: "github_repository_request_failed",
      retryable: true,
    });
    expect(networkResult.failure.message).not.toContain("socket secret");
  });

  it("enforces per-request timeout and response-body bounds", async () => {
    vi.useFakeTimers();

    const timeoutFetch = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("internal abort detail"));
        });
      });
    });
    const timeoutAdapter = createAdapter(timeoutFetch, {
      timeoutMs: 1,
    });
    const timeoutPromise = timeoutAdapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    await vi.runAllTimersAsync();
    const timeoutResult = await timeoutPromise;

    expect(timeoutResult.ok).toBe(false);

    if (timeoutResult.ok) {
      throw new Error("Expected timeout failure");
    }

    expect(timeoutResult.failure).toMatchObject({
      code: "github_repository_timeout",
      retryable: true,
    });
    expect(timeoutResult.failure.message).not.toContain("internal abort detail");

    vi.useRealTimers();

    const tooLargeAdapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(repositoryPayload())),
      {
        maxResponseBytes: 8,
      },
    );
    const tooLargeResult = await tooLargeAdapter.fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(tooLargeResult.ok).toBe(false);

    if (tooLargeResult.ok) {
      throw new Error("Expected response limit failure");
    }

    expect(tooLargeResult.failure).toMatchObject({
      code: "github_repository_response_too_large",
      retryable: false,
    });
  });

  it("keeps full selected source content out of source/evidence/limitation/failure provenance", async () => {
    const packageJson = '{"scripts":{"token":"SUPER_SECRET_VALUE"}}';
    const tree = treePayload([treeEntry("package.json", manifestSha, packageJson.length)]);
    const fetchImpl = successfulBaseFetch(tree, [blobPayload(manifestSha, packageJson)]);
    const result = await createAdapter(fetchImpl).fetch({
      repositoryUrl: `https://github.com/${owner}/${name}`,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected successful acquisition");
    }

    expect(result.data.manifest?.content).toContain("SUPER_SECRET_VALUE");
    expect(
      JSON.stringify({
        source: result.source,
        evidence: result.evidence,
        limitations: result.data.limitations,
        failures: result.partialFailures,
      }),
    ).not.toContain("SUPER_SECRET_VALUE");
  });
});
