import { describe, expect, it, vi } from "vitest";

import { DataSourceSchema, EvidenceSchema, PartialFailureSchema } from "@stacklens/contracts";

import {
  NPM_REGISTRY_PROVIDER_ID,
  NpmRegistryAdapter,
  npmRegistryEvidenceId,
  npmRegistryPackageUrl,
  npmRegistrySourceId,
} from "../src/index.js";

const observedAt = "2026-09-19T05:30:00Z";

function createAdapter(
  fetchImpl: typeof fetch,
  options: {
    readonly maxResponseBytes?: number;
    readonly timeoutMs?: number;
  } = {},
) {
  return new NpmRegistryAdapter({
    fetchImpl,
    now: () => observedAt,
    ...options,
  });
}

function createPackument() {
  return {
    name: "@stacklens/example",
    "dist-tags": {
      next: "2.0.0",
      latest: "1.1.0",
    },
    versions: {
      "2.0.0": {
        name: "@stacklens/example",
        version: "2.0.0",
        deprecated: "Use version 1.x until the next migration guide is available.",
      },
      "1.0.0": {
        name: "@stacklens/example",
        version: "1.0.0",
      },
      "1.1.0": {
        name: "@stacklens/example",
        version: "1.1.0",
      },
    },
    time: {
      created: "2026-01-01T00:00:00.000Z",
      modified: "2026-09-18T12:00:00.000Z",
      "1.0.0": "2026-01-01T00:00:00.000Z",
      "1.1.0": "2026-04-01T00:00:00.000Z",
      "2.0.0": "2026-09-18T12:00:00.000Z",
    },
    repository: {
      type: "git",
      url: "git+https://github.com/example/example.git",
      directory: "packages/example",
    },
  };
}

describe("NpmRegistryAdapter [FR-006, FR-007, FR-010, DATA-001, DATA-002]", () => {
  it("normalizes npm package metadata with provenance and retrieval time", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(createPackument()), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected npm metadata acquisition to succeed");
    }

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://registry.npmjs.org/%40stacklens%2Fexample",
      expect.objectContaining({
        method: "GET",
        headers: {
          accept: "application/json",
        },
      }),
    );
    expect(result.data).toEqual({
      packageName: "@stacklens/example",
      registryCreatedAt: "2026-01-01T00:00:00.000Z",
      registryModifiedAt: "2026-09-18T12:00:00.000Z",
      distTags: [
        {
          tag: "latest",
          version: "1.1.0",
        },
        {
          tag: "next",
          version: "2.0.0",
        },
      ],
      versions: [
        {
          version: "1.0.0",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          version: "1.1.0",
          publishedAt: "2026-04-01T00:00:00.000Z",
        },
        {
          version: "2.0.0",
          deprecatedMessage: "Use version 1.x until the next migration guide is available.",
          publishedAt: "2026-09-18T12:00:00.000Z",
        },
      ],
      repository: {
        url: "git+https://github.com/example/example.git",
        type: "git",
        directory: "packages/example",
      },
    });
    expect(result.source).toEqual({
      id: npmRegistrySourceId("@stacklens/example"),
      provider: NPM_REGISTRY_PROVIDER_ID,
      status: "available",
      retrievedAt: observedAt,
      reference: npmRegistryPackageUrl("@stacklens/example"),
    });
    expect(result.evidence).toEqual([
      {
        id: npmRegistryEvidenceId("@stacklens/example"),
        kind: "external",
        sourceId: npmRegistrySourceId("@stacklens/example"),
        summary: "npm Registry package metadata for @stacklens/example",
        reference: npmRegistryPackageUrl("@stacklens/example"),
        url: npmRegistryPackageUrl("@stacklens/example"),
      },
    ]);
    expect(result.partialFailures).toEqual([]);
    expect(DataSourceSchema.safeParse(result.source).success).toBe(true);
    expect(EvidenceSchema.safeParse(result.evidence[0]).success).toBe(true);
  });

  it("accepts metadata when optional time and repository fields are absent", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            name: "minimal-package",
            "dist-tags": {
              latest: "1.0.0",
            },
            versions: {
              "1.0.0": {
                name: "minimal-package",
                version: "1.0.0",
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await adapter.fetch({
      packageName: "minimal-package",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected minimal npm metadata to succeed");
    }

    expect(result.data).toEqual({
      packageName: "minimal-package",
      distTags: [
        {
          tag: "latest",
          version: "1.0.0",
        },
      ],
      versions: [
        {
          version: "1.0.0",
        },
      ],
    });
  });

  it("treats an empty deprecation message as not deprecated", async () => {
    const packument = createPackument();
    const undeprecatedPackument = {
      ...packument,
      versions: {
        ...packument.versions,
        "2.0.0": {
          ...packument.versions["2.0.0"],
          deprecated: "   ",
        },
      },
    };
    const adapter = createAdapter(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(undeprecatedPackument), { status: 200 })),
    );

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected empty deprecation message to normalize successfully");
    }

    expect(result.data.versions.find((version) => version.version === "2.0.0")).toEqual({
      version: "2.0.0",
      publishedAt: "2026-09-18T12:00:00.000Z",
    });
  });

  it("normalizes equivalent provider objects deterministically", async () => {
    const first = createPackument();
    const second = {
      ...first,
      "dist-tags": {
        latest: "1.1.0",
        next: "2.0.0",
      },
      versions: {
        "1.1.0": first.versions["1.1.0"],
        "2.0.0": first.versions["2.0.0"],
        "1.0.0": first.versions["1.0.0"],
      },
    };
    const firstAdapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(first), { status: 200 })),
    );
    const secondAdapter = createAdapter(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(second), { status: 200 })),
    );

    const firstResult = await firstAdapter.fetch({
      packageName: "@stacklens/example",
    });
    const secondResult = await secondAdapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    if (!firstResult.ok || !secondResult.ok) {
      throw new Error("Expected equivalent npm responses to normalize successfully");
    }

    expect(firstResult.data).toEqual(secondResult.data);
  });

  it("does not promote publisher-controlled repository URLs into evidence links", async () => {
    const packument = {
      ...createPackument(),
      repository: {
        type: "git",
        url: "https://example.invalid/untrusted",
      },
    };
    const adapter = createAdapter(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(packument), { status: 200 })),
    );

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected npm metadata acquisition to succeed");
    }

    expect(result.data.repository?.url).toBe("https://example.invalid/untrusted");
    expect(result.evidence[0]?.url).toBe("https://registry.npmjs.org/%40stacklens%2Fexample");
  });

  it("rejects a response whose package identity does not match the request", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...createPackument(),
            name: "@stacklens/other",
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected mismatched package metadata to fail");
    }

    expect(result.failure.code).toBe("npm_invalid_response");
    expect(result.failure.retryable).toBe(false);
    expect(PartialFailureSchema.safeParse(result.failure).success).toBe(true);
  });

  it("rejects malformed deprecation metadata rather than coercing it", async () => {
    const packument = createPackument();
    const malformedPackument = {
      ...packument,
      versions: {
        ...packument.versions,
        "2.0.0": {
          ...packument.versions["2.0.0"],
          deprecated: 123,
        },
      },
    };
    const adapter = createAdapter(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(malformedPackument), { status: 200 })),
    );

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected malformed deprecation metadata to fail");
    }

    expect(result.failure.code).toBe("npm_invalid_response");
    expect(result.failure.message).toBe(
      "npm Registry returned an unsupported metadata shape for @stacklens/example.",
    );
    expect(result.failure.message).not.toContain("deprecated");
  });

  it("rejects dist-tags that point at absent versions", async () => {
    const packument = createPackument();
    const invalidPackument = {
      ...packument,
      "dist-tags": {
        ...packument["dist-tags"],
        latest: "9.9.9",
      },
    };
    const adapter = createAdapter(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify(invalidPackument), { status: 200 })),
    );

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected invalid dist-tag metadata to fail");
    }

    expect(result.failure.code).toBe("npm_invalid_response");
    expect(result.failure.message).toBe(
      "npm Registry returned an unsupported metadata shape for @stacklens/example.",
    );
    expect(result.failure.message).not.toContain("9.9.9");
  });

  it("returns a non-retryable typed failure for invalid provider JSON", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(new Response("{invalid", { status: 200 })),
    );

    const result = await adapter.fetch({
      packageName: "react",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected invalid provider JSON to fail");
    }

    expect(result.failure).toMatchObject({
      code: "npm_invalid_json",
      retryable: false,
    });
  });

  it("returns a retryable typed timeout without exposing transport details", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("internal timeout detail", "AbortError"));
            },
            { once: true },
          );
        }),
    );
    const adapter = createAdapter(fetchImpl, {
      timeoutMs: 1,
    });

    const result = await adapter.fetch({
      packageName: "react",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected timed-out provider request to fail");
    }

    expect(result.failure).toMatchObject({
      code: "npm_request_timeout",
      retryable: true,
    });
    expect(result.failure.message).not.toContain("internal timeout detail");
  });

  it("returns a non-retryable typed failure for a missing package", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(new Response("not found", { status: 404 })),
    );

    const result = await adapter.fetch({
      packageName: "missing-package",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected missing package acquisition to fail");
    }

    expect(result.source.status).toBe("unavailable");
    expect(result.failure).toMatchObject({
      scope: "source",
      sourceId: npmRegistrySourceId("missing-package"),
      code: "npm_http_404",
      retryable: false,
      occurredAt: observedAt,
    });
    expect(DataSourceSchema.safeParse(result.source).success).toBe(true);
    expect(PartialFailureSchema.safeParse(result.failure).success).toBe(true);
  });

  it("marks npm throttling as retryable without using the response body as evidence", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );

    const result = await adapter.fetch({
      packageName: "react",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected throttled request to fail");
    }

    expect(result.failure.code).toBe("npm_http_429");
    expect(result.failure.retryable).toBe(true);
    expect(result.failure.message).not.toContain("rate limited");
  });

  it("returns a retryable typed failure when the provider request throws", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockRejectedValue(new Error("socket details should not leak")),
    );

    const result = await adapter.fetch({
      packageName: "react",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected network failure");
    }

    expect(result.failure).toMatchObject({
      code: "npm_request_failed",
      retryable: true,
    });
    expect(result.failure.message).not.toContain("socket details");
  });

  it("enforces the configured response-size limit", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(createPackument()), {
          status: 200,
        }),
      ),
      {
        maxResponseBytes: 64,
      },
    );

    const result = await adapter.fetch({
      packageName: "@stacklens/example",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected oversized provider response to fail");
    }

    expect(result.failure).toMatchObject({
      code: "npm_response_too_large",
      retryable: false,
    });
  });

  it("rejects malformed request names before making a network request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      packageName: " react ",
    });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();

    if (result.ok) {
      throw new Error("Expected malformed package name to fail");
    }

    expect(result.failure.code).toBe("npm_invalid_package_name");
    expect(result.failure.retryable).toBe(false);
  });
});
