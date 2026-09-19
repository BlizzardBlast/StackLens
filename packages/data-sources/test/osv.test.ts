import { describe, expect, it, vi } from "vitest";

import { DataSourceSchema, EvidenceSchema, PartialFailureSchema } from "@stacklens/contracts";

import {
  OSV_PROVIDER_ID,
  OSV_QUERY_BATCH_URL,
  OsvVulnerabilityAdapter,
  osvSourceId,
  osvVulnerabilityPageUrl,
} from "../src/index.js";

const observedAt = "2026-09-19T06:15:00Z";

function createAdapter(
  fetchImpl: typeof fetch,
  options: {
    readonly maxPaginationRounds?: number;
    readonly maxQueries?: number;
    readonly maxResponseBytes?: number;
    readonly timeoutMs?: number;
  } = {},
) {
  return new OsvVulnerabilityAdapter({
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

function createVulnerability(
  id: string,
  packageName: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    schema_version: "1.8.0",
    summary: `Advisory for ${packageName}`,
    modified: "2026-09-18T12:30:00Z",
    published: "2026-09-17T08:00:00Z",
    aliases: ["CVE-2026-1000"],
    related: ["GHSA-related"],
    upstream: ["CVE-2026-0999"],
    severity: [
      {
        type: "CVSS_V3",
        score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        source: "NVD",
      },
    ],
    references: [
      {
        type: "WEB",
        url: "https://example.com/reference",
      },
      {
        type: "ADVISORY",
        url: "https://github.com/advisories/GHSA-example",
      },
    ],
    affected: [
      {
        package: {
          ecosystem: "npm",
          name: packageName,
          purl: `pkg:npm/${encodeURIComponent(packageName)}`,
        },
        versions: ["1.0.0"],
        severity: [
          {
            type: "CVSS_V4",
            score: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
            source: "GHSA",
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("OsvVulnerabilityAdapter [FR-011, DATA-001, DATA-002, NFR-003, SEC-008]", () => {
  it("normalizes exact-version batch matches and advisory details deterministically", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-aaaa-bbbb-cccc",
                  modified: "2026-09-18T10:00:00Z",
                },
              ],
            },
            {
              vulns: [
                {
                  id: "GHSA-zzzz-yyyy-xxxx",
                  modified: "2026-09-18T11:00:00Z",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          createVulnerability("GHSA-aaaa-bbbb-cccc", "lodash", {
            aliases: ["CVE-2026-2000", "CVE-2026-1000"],
            withdrawn: "2026-09-19T00:00:00Z",
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(createVulnerability("GHSA-zzzz-yyyy-xxxx", "react")),
      );
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "react",
          version: "18.2.0",
        },
        {
          packageName: "lodash",
          version: "4.17.20",
        },
        {
          packageName: "react",
          version: "18.2.0",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected OSV acquisition to succeed");
    }

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const firstCall = fetchImpl.mock.calls[0];

    if (firstCall === undefined) {
      throw new Error("Expected OSV batch request");
    }

    expect(firstCall[0]).toBe(OSV_QUERY_BATCH_URL);
    expect(firstCall[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      }),
    );
    const firstBody = firstCall[1]?.body;

    if (typeof firstBody !== "string") {
      throw new Error("Expected serialized OSV batch request body");
    }

    expect(JSON.parse(firstBody)).toEqual({
      queries: [
        {
          package: {
            ecosystem: "npm",
            name: "lodash",
          },
          version: "4.17.20",
        },
        {
          package: {
            ecosystem: "npm",
            name: "react",
          },
          version: "18.2.0",
        },
      ],
    });
    expect(result.source).toEqual({
      id: osvSourceId([
        {
          packageName: "lodash",
          version: "4.17.20",
        },
        {
          packageName: "react",
          version: "18.2.0",
        },
      ]),
      provider: OSV_PROVIDER_ID,
      status: "available",
      retrievedAt: observedAt,
      reference: OSV_QUERY_BATCH_URL,
    });
    expect(result.data.queryResults).toEqual([
      {
        packageName: "lodash",
        version: "4.17.20",
        complete: true,
        matches: [
          {
            id: "GHSA-aaaa-bbbb-cccc",
            modifiedAt: "2026-09-18T10:00:00Z",
          },
        ],
      },
      {
        packageName: "react",
        version: "18.2.0",
        complete: true,
        matches: [
          {
            id: "GHSA-zzzz-yyyy-xxxx",
            modifiedAt: "2026-09-18T11:00:00Z",
          },
        ],
      },
    ]);
    expect(result.data.vulnerabilities).toHaveLength(2);
    expect(result.data.vulnerabilities[0]).toMatchObject({
      id: "GHSA-aaaa-bbbb-cccc",
      schemaVersion: "1.8.0",
      modifiedAt: "2026-09-18T12:30:00Z",
      publishedAt: "2026-09-17T08:00:00Z",
      withdrawnAt: "2026-09-19T00:00:00Z",
      aliases: ["CVE-2026-1000", "CVE-2026-2000"],
      related: ["GHSA-related"],
      upstream: ["CVE-2026-0999"],
      severities: [
        {
          type: "CVSS_V3",
          score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
          source: "NVD",
        },
      ],
      affected: [
        expect.objectContaining({
          packageName: "lodash",
          ecosystem: "npm",
          severities: [
            {
              type: "CVSS_V4",
              score: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
              source: "GHSA",
            },
          ],
        }),
      ],
    });
    expect(result.data.vulnerabilities[0]?.references).toEqual([
      {
        type: "ADVISORY",
        url: "https://github.com/advisories/GHSA-example",
      },
      {
        type: "WEB",
        url: "https://example.com/reference",
      },
    ]);
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toMatchObject({
      kind: "external",
      sourceId: result.source.id,
      reference: "GHSA-aaaa-bbbb-cccc",
      url: osvVulnerabilityPageUrl("GHSA-aaaa-bbbb-cccc"),
      publishedAt: "2026-09-17T08:00:00Z",
    });
    expect(result.partialFailures).toEqual([]);
    expect(DataSourceSchema.safeParse(result.source).success).toBe(true);

    for (const evidence of result.evidence) {
      expect(EvidenceSchema.safeParse(evidence).success).toBe(true);
    }
  });

  it("keeps an empty OSV match set as available data without describing the dependency as secure", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          results: [{}],
        }),
      ),
    );

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "react",
          version: "18.2.0",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected empty OSV query to succeed");
    }

    expect(result.source.status).toBe("available");
    expect(result.data.queryResults).toEqual([
      {
        packageName: "react",
        version: "18.2.0",
        matches: [],
        complete: true,
      },
    ]);
    expect(result.data.vulnerabilities).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("secure");
  });

  it.each(["^1.2.3", "~1.2.3", ">=1.2.3", "1.2", "latest", "v1.2.3"])(
    "rejects non-exact npm version evidence %s before network access",
    async (version) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const adapter = createAdapter(fetchImpl);

      const result = await adapter.fetch({
        queries: [
          {
            packageName: "example-package",
            version,
          },
        ],
      });

      expect(result.ok).toBe(false);
      expect(fetchImpl).not.toHaveBeenCalled();

      if (result.ok) {
        throw new Error("Expected non-exact version evidence to fail");
      }

      expect(result.failure.code).toBe("osv_invalid_request");
      expect(result.failure.retryable).toBe(false);
      expect(PartialFailureSchema.safeParse(result.failure).success).toBe(true);
    },
  );

  it("accepts an exact prerelease/build npm version", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        results: [{}],
      }),
    );
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.2.3-beta.1+build.5",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("accumulates paginated batch results before fetching advisory details", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-aaaa-bbbb-cccc",
                  modified: "2026-09-18T10:00:00Z",
                },
              ],
              next_page_token: "page-2",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-dddd-eeee-ffff",
                  modified: "2026-09-18T11:00:00Z",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(createVulnerability("GHSA-aaaa-bbbb-cccc", "example-package")),
      )
      .mockResolvedValueOnce(
        jsonResponse(createVulnerability("GHSA-dddd-eeee-ffff", "example-package")),
      );
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected paginated OSV acquisition to succeed");
    }

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    const paginationCall = fetchImpl.mock.calls[1];

    if (paginationCall === undefined) {
      throw new Error("Expected OSV pagination request");
    }

    const paginationBody = paginationCall[1]?.body;

    if (typeof paginationBody !== "string") {
      throw new Error("Expected serialized OSV pagination request body");
    }

    expect(JSON.parse(paginationBody)).toEqual({
      queries: [
        {
          package: {
            ecosystem: "npm",
            name: "example-package",
          },
          version: "1.0.0",
          page_token: "page-2",
        },
      ],
    });
    expect(result.data.queryResults[0]).toEqual({
      packageName: "example-package",
      version: "1.0.0",
      complete: true,
      matches: [
        {
          id: "GHSA-aaaa-bbbb-cccc",
          modifiedAt: "2026-09-18T10:00:00Z",
        },
        {
          id: "GHSA-dddd-eeee-ffff",
          modifiedAt: "2026-09-18T11:00:00Z",
        },
      ],
    });
    expect(result.source.status).toBe("available");
  });

  it("marks a repeated pagination token as partial without losing known matches", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-aaaa-bbbb-cccc",
                  modified: "2026-09-18T10:00:00Z",
                },
              ],
              next_page_token: "same-token",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              next_page_token: "same-token",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(createVulnerability("GHSA-aaaa-bbbb-cccc", "example-package")),
      );
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial OSV acquisition");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.queryResults[0]?.complete).toBe(false);
    expect(result.data.queryResults[0]?.matches).toEqual([
      {
        id: "GHSA-aaaa-bbbb-cccc",
        modifiedAt: "2026-09-18T10:00:00Z",
      },
    ]);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures[0]).toMatchObject({
      code: "osv_pagination_incomplete",
      retryable: true,
      sourceId: result.source.id,
    });
    expect(PartialFailureSchema.safeParse(result.partialFailures[0]).success).toBe(true);
  });

  it("keeps an authoritative batch match when advisory detail retrieval fails", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-aaaa-bbbb-cccc",
                  modified: "2026-09-18T10:00:00Z",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial OSV detail acquisition");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.queryResults[0]?.matches).toHaveLength(1);
    expect(result.data.vulnerabilities).toEqual([]);
    expect(result.evidence).toEqual([
      expect.objectContaining({
        reference: "GHSA-aaaa-bbbb-cccc",
        url: osvVulnerabilityPageUrl("GHSA-aaaa-bbbb-cccc"),
      }),
    ]);
    expect(result.partialFailures[0]).toMatchObject({
      code: "osv_detail_http_503",
      retryable: true,
    });
  });

  it("treats malformed advisory detail as partial and never promotes unsafe references", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-aaaa-bbbb-cccc",
                  modified: "2026-09-18T10:00:00Z",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          createVulnerability("GHSA-aaaa-bbbb-cccc", "example-package", {
            references: [
              {
                type: "WEB",
                url: "javascript:alert(1)",
              },
            ],
          }),
        ),
      );
    const adapter = createAdapter(fetchImpl);

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error("Expected partial OSV detail acquisition");
    }

    expect(result.source.status).toBe("partial");
    expect(result.data.vulnerabilities).toEqual([]);
    expect(result.evidence[0]?.url).toBe(osvVulnerabilityPageUrl("GHSA-aaaa-bbbb-cccc"));
    expect(result.partialFailures[0]?.code).toBe("osv_invalid_detail_response");
  });

  it("returns an unavailable typed source failure when the initial batch request fails", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected unavailable OSV source");
    }

    expect(result.source).toMatchObject({
      provider: OSV_PROVIDER_ID,
      status: "unavailable",
      reference: OSV_QUERY_BATCH_URL,
    });
    expect(result.failure).toMatchObject({
      code: "osv_query_http_429",
      retryable: true,
      sourceId: result.source.id,
    });
    expect(DataSourceSchema.safeParse(result.source).success).toBe(true);
    expect(PartialFailureSchema.safeParse(result.failure).success).toBe(true);
    expect(result.failure.message).not.toContain("rate limited");
  });

  it("fails closed when the initial batch response shape is invalid", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          results: [],
        }),
      ),
    );

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected invalid batch response to fail");
    }

    expect(result.failure).toMatchObject({
      code: "osv_invalid_query_response",
      retryable: false,
    });
  });

  it("rejects unbounded query batches before network access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const adapter = createAdapter(fetchImpl, {
      maxQueries: 2,
    });

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "a",
          version: "1.0.0",
        },
        {
          packageName: "b",
          version: "1.0.0",
        },
        {
          packageName: "c",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();

    if (result.ok) {
      throw new Error("Expected oversized OSV query batch to fail");
    }

    expect(result.failure.code).toBe("osv_invalid_request");
  });

  it("enforces the configured response-size limit", async () => {
    const adapter = createAdapter(
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          results: [{}],
        }),
      ),
      {
        maxResponseBytes: 8,
      },
    );

    const result = await adapter.fetch({
      queries: [
        {
          packageName: "example-package",
          version: "1.0.0",
        },
      ],
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("Expected oversized OSV response to fail");
    }

    expect(result.failure).toMatchObject({
      code: "osv_query_response_too_large",
      retryable: false,
    });
  });
});
