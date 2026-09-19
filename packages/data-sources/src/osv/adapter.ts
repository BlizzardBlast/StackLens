import { IsoDateTimeSchema } from "@stacklens/contracts";
import type {
  AvailableDataSource,
  ExternalEvidence,
  PartialDataSource,
  PartialFailure,
  UnavailableDataSource,
} from "@stacklens/contracts";

import { ProviderResponseTooLargeError, readBoundedResponseText } from "../http.js";
import { isExactNpmVersion, isValidNpmPackageName } from "../npm-package.js";
import type { EvidenceProvider, ProviderFailure, ProviderResult } from "../provider.js";
import {
  osvEvidenceId,
  osvFailureId,
  osvQueryEvidenceId,
  osvQueryEvidenceReference,
  osvInvalidRequestSourceId,
  osvQueryKey,
  osvSourceId,
  osvVulnerabilityApiUrl,
  osvVulnerabilityPageUrl,
} from "./ids.js";
import { OsvPayloadError, parseOsvBatchResponse, parseOsvVulnerability } from "./metadata.js";
import type { ParsedBatchResult } from "./metadata.js";
import {
  OSV_DEFAULT_MAX_ADVISORY_DETAILS,
  OSV_DEFAULT_MAX_PAGINATION_ROUNDS,
  OSV_DEFAULT_MAX_QUERIES,
  OSV_DEFAULT_MAX_RESPONSE_BYTES,
  OSV_DEFAULT_TIMEOUT_MS,
  OSV_PROVIDER_ID,
  OSV_QUERY_BATCH_URL,
} from "./types.js";
import type {
  OsvAdapterOptions,
  OsvPackageVersionQuery,
  OsvPackageVersionResult,
  OsvQueryVulnerabilityMatch,
  OsvVulnerabilityRecord,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
} from "./types.js";

const OSV_ACCEPT = "application/json";
const OSV_CONTENT_TYPE = "application/json";
const CONTRACT_REFERENCE_MAX_LENGTH = 1_000;

interface PendingQuery {
  readonly query: OsvPackageVersionQuery;
  readonly pageToken?: string;
  readonly pageRound: number;
}

interface QueryAccumulator {
  readonly query: OsvPackageVersionQuery;
  readonly matches: Map<string, OsvQueryVulnerabilityMatch>;
  complete: boolean;
}

interface JsonRequestFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

type JsonRequestResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly failure: JsonRequestFailure };

class OsvConfigurationError extends Error {}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OsvConfigurationError(`${label} must be a positive safe integer`);
  }

  return value;
}

function validateObservedAt(value: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new OsvConfigurationError("now() must return an ISO 8601 timestamp with an offset");
  }

  return parsed.data;
}

function safeInvalidRequestKey(request: OsvVulnerabilityRequest): string {
  if (!Array.isArray(request.queries)) {
    return "invalid-queries";
  }

  return request.queries
    .map((query) => {
      if (typeof query !== "object" || query === null) {
        return "invalid-query";
      }

      const packageName =
        "packageName" in query && typeof query.packageName === "string"
          ? query.packageName
          : "invalid-package";
      const version =
        "version" in query && typeof query.version === "string" ? query.version : "invalid-version";

      return JSON.stringify([packageName, version]);
    })
    .join("\n");
}

function normalizeQueries(
  request: OsvVulnerabilityRequest,
  maxQueries: number,
): readonly OsvPackageVersionQuery[] | null {
  if (
    !Array.isArray(request.queries) ||
    request.queries.length === 0 ||
    request.queries.length > maxQueries
  ) {
    return null;
  }

  const normalized = new Map<string, OsvPackageVersionQuery>();

  for (const query of request.queries) {
    if (
      typeof query !== "object" ||
      query === null ||
      !isValidNpmPackageName(query.packageName) ||
      !isExactNpmVersion(query.version)
    ) {
      return null;
    }

    normalized.set(osvQueryKey(query), {
      packageName: query.packageName,
      version: query.version,
    });
  }

  return [...normalized.values()].toSorted((left, right) => {
    const packageOrder = compareCodeUnits(left.packageName, right.packageName);
    return packageOrder === 0 ? compareCodeUnits(left.version, right.version) : packageOrder;
  });
}

function createUnavailableResult(
  sourceId: string,
  attemptedAt: string,
  code: string,
  message: string,
  retryable: boolean,
  context = "",
): ProviderFailure {
  const source: UnavailableDataSource = {
    id: sourceId,
    provider: OSV_PROVIDER_ID,
    status: "unavailable",
    attemptedAt,
    reference: OSV_QUERY_BATCH_URL,
  };
  const failure: PartialFailure = {
    id: osvFailureId(sourceId, code, context),
    scope: "source",
    sourceId,
    code,
    message,
    retryable,
    occurredAt: attemptedAt,
  };

  return {
    ok: false,
    source,
    failure,
  };
}

function createPartialFailure(
  sourceId: string,
  occurredAt: string,
  code: string,
  message: string,
  retryable: boolean,
  context = "",
): PartialFailure {
  return {
    id: osvFailureId(sourceId, code, context),
    scope: "source",
    sourceId,
    code,
    message,
    retryable,
    occurredAt,
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export class OsvVulnerabilityAdapter implements EvidenceProvider<
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot
> {
  readonly id = OSV_PROVIDER_ID;

  readonly #fetchImpl: typeof fetch;
  readonly #now: () => string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;
  readonly #maxQueries: number;
  readonly #maxPaginationRounds: number;
  readonly #maxAdvisoryDetails: number;

  constructor(options: OsvAdapterOptions = {}) {
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#timeoutMs = validatePositiveInteger(
      options.timeoutMs ?? OSV_DEFAULT_TIMEOUT_MS,
      "timeoutMs",
    );
    this.#maxResponseBytes = validatePositiveInteger(
      options.maxResponseBytes ?? OSV_DEFAULT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
    );
    this.#maxQueries = validatePositiveInteger(
      options.maxQueries ?? OSV_DEFAULT_MAX_QUERIES,
      "maxQueries",
    );
    this.#maxPaginationRounds = validatePositiveInteger(
      options.maxPaginationRounds ?? OSV_DEFAULT_MAX_PAGINATION_ROUNDS,
      "maxPaginationRounds",
    );
    this.#maxAdvisoryDetails = validatePositiveInteger(
      options.maxAdvisoryDetails ?? OSV_DEFAULT_MAX_ADVISORY_DETAILS,
      "maxAdvisoryDetails",
    );
  }

  async fetch(request: OsvVulnerabilityRequest): Promise<ProviderResult<OsvVulnerabilitySnapshot>> {
    const queries = normalizeQueries(request, this.#maxQueries);

    if (queries === null) {
      const sourceId = osvInvalidRequestSourceId(safeInvalidRequestKey(request));

      return createUnavailableResult(
        sourceId,
        validateObservedAt(this.#now()),
        "osv_invalid_request",
        `OSV npm queries must contain 1-${this.#maxQueries} unique-capable package/version entries using valid npm package names and exact semantic versions.`,
        false,
      );
    }

    const sourceId = osvSourceId(queries);
    const accumulators = new Map<string, QueryAccumulator>(
      queries.map((query) => [
        osvQueryKey(query),
        {
          query,
          matches: new Map(),
          complete: true,
        },
      ]),
    );
    const partialFailures: PartialFailure[] = [];

    const initialPending: PendingQuery[] = queries.map((query) => ({
      query,
      pageRound: 0,
    }));

    const acquireBatchPages = async (
      pending: readonly PendingQuery[],
      acquiredAnyBatchPage: boolean,
    ): Promise<ProviderFailure | null> => {
      if (pending.length === 0) {
        return null;
      }

      const body = {
        queries: pending.map((entry) => ({
          package: {
            name: entry.query.packageName,
            ecosystem: "npm",
          },
          version: entry.query.version,
          ...(entry.pageToken === undefined ? {} : { page_token: entry.pageToken }),
        })),
      };
      const batchResult = await this.#requestJson(
        OSV_QUERY_BATCH_URL,
        {
          method: "POST",
          headers: {
            accept: OSV_ACCEPT,
            "content-type": OSV_CONTENT_TYPE,
          },
          body: JSON.stringify(body),
        },
        "osv_query",
      );

      if (!batchResult.ok) {
        const occurredAt = validateObservedAt(this.#now());

        if (!acquiredAnyBatchPage) {
          return createUnavailableResult(
            sourceId,
            occurredAt,
            batchResult.failure.code,
            batchResult.failure.message,
            batchResult.failure.retryable,
          );
        }

        for (const entry of pending) {
          const accumulator = accumulators.get(osvQueryKey(entry.query));

          if (accumulator !== undefined) {
            accumulator.complete = false;
          }
        }

        partialFailures.push(
          createPartialFailure(
            sourceId,
            occurredAt,
            batchResult.failure.code,
            batchResult.failure.message,
            batchResult.failure.retryable,
            "pagination",
          ),
        );
        return null;
      }

      let parsedBatch: readonly ParsedBatchResult[];

      try {
        parsedBatch = parseOsvBatchResponse(batchResult.value, pending.length);
      } catch (error) {
        if (!(error instanceof OsvPayloadError)) {
          throw error;
        }

        const occurredAt = validateObservedAt(this.#now());

        if (!acquiredAnyBatchPage) {
          return createUnavailableResult(
            sourceId,
            occurredAt,
            "osv_invalid_query_response",
            "OSV returned an unsupported batch-query response.",
            false,
          );
        }

        for (const entry of pending) {
          const accumulator = accumulators.get(osvQueryKey(entry.query));

          if (accumulator !== undefined) {
            accumulator.complete = false;
          }
        }

        partialFailures.push(
          createPartialFailure(
            sourceId,
            occurredAt,
            "osv_invalid_query_response",
            "OSV returned an unsupported paginated batch-query response.",
            false,
            "pagination",
          ),
        );
        return null;
      }

      const nextPending: PendingQuery[] = [];

      for (const [index, parsedResult] of parsedBatch.entries()) {
        const pendingEntry = pending[index];

        if (pendingEntry === undefined) {
          throw new OsvConfigurationError("OSV batch response indexing invariant failed");
        }

        const accumulator = accumulators.get(osvQueryKey(pendingEntry.query));

        if (accumulator === undefined) {
          throw new OsvConfigurationError("OSV query accumulator invariant failed");
        }

        for (const match of parsedResult.matches) {
          const existing = accumulator.matches.get(match.id);

          if (
            existing === undefined ||
            Date.parse(match.modifiedAt) > Date.parse(existing.modifiedAt)
          ) {
            accumulator.matches.set(match.id, match);
          }
        }

        if (parsedResult.nextPageToken === undefined) {
          continue;
        }

        const nextRound = pendingEntry.pageRound + 1;

        if (
          nextRound >= this.#maxPaginationRounds ||
          parsedResult.nextPageToken === pendingEntry.pageToken
        ) {
          accumulator.complete = false;
          partialFailures.push(
            createPartialFailure(
              sourceId,
              validateObservedAt(this.#now()),
              "osv_pagination_incomplete",
              "OSV pagination could not be completed within the configured safety bound.",
              true,
              osvQueryKey(pendingEntry.query),
            ),
          );
          continue;
        }

        nextPending.push({
          query: pendingEntry.query,
          pageToken: parsedResult.nextPageToken,
          pageRound: nextRound,
        });
      }

      return acquireBatchPages(nextPending, true);
    };

    const unavailableResult = await acquireBatchPages(initialPending, false);

    if (unavailableResult !== null) {
      return unavailableResult;
    }

    const queryResults: OsvPackageVersionResult[] = [...accumulators.values()]
      .map((accumulator) => ({
        packageName: accumulator.query.packageName,
        version: accumulator.query.version,
        matches: [...accumulator.matches.values()].toSorted((left, right) =>
          compareCodeUnits(left.id, right.id),
        ),
        complete: accumulator.complete,
      }))
      .toSorted((left, right) => {
        const packageOrder = compareCodeUnits(left.packageName, right.packageName);
        return packageOrder === 0 ? compareCodeUnits(left.version, right.version) : packageOrder;
      });

    const matchedPackagesByVulnerability = new Map<string, Set<string>>();

    for (const result of queryResults) {
      for (const match of result.matches) {
        const packageNames = matchedPackagesByVulnerability.get(match.id) ?? new Set<string>();
        packageNames.add(result.packageName);
        matchedPackagesByVulnerability.set(match.id, packageNames);
      }
    }

    const vulnerabilities: OsvVulnerabilityRecord[] = [];
    const allVulnerabilityIds = [...matchedPackagesByVulnerability.keys()].toSorted(
      compareCodeUnits,
    );
    const vulnerabilityIds = allVulnerabilityIds.slice(0, this.#maxAdvisoryDetails);

    if (allVulnerabilityIds.length > vulnerabilityIds.length) {
      partialFailures.push(
        createPartialFailure(
          sourceId,
          validateObservedAt(this.#now()),
          "osv_detail_limit_reached",
          "OSV advisory detail acquisition reached the configured safety bound; batch matches remain available.",
          false,
          "detail-limit",
        ),
      );
    }

    const resolveDetails = async (index: number): Promise<void> => {
      const vulnerabilityId = vulnerabilityIds[index];

      if (vulnerabilityId === undefined) {
        return;
      }

      const detailResult = await this.#requestJson(
        osvVulnerabilityApiUrl(vulnerabilityId),
        {
          method: "GET",
          headers: {
            accept: OSV_ACCEPT,
          },
        },
        "osv_detail",
      );

      if (!detailResult.ok) {
        partialFailures.push(
          createPartialFailure(
            sourceId,
            validateObservedAt(this.#now()),
            detailResult.failure.code,
            `OSV advisory detail acquisition failed for ${vulnerabilityId}.`,
            detailResult.failure.retryable,
            vulnerabilityId,
          ),
        );
        return resolveDetails(index + 1);
      }

      try {
        vulnerabilities.push(
          parseOsvVulnerability(
            detailResult.value,
            vulnerabilityId,
            matchedPackagesByVulnerability.get(vulnerabilityId) ?? new Set(),
          ),
        );
      } catch (error) {
        if (!(error instanceof OsvPayloadError)) {
          throw error;
        }

        partialFailures.push(
          createPartialFailure(
            sourceId,
            validateObservedAt(this.#now()),
            "osv_invalid_detail_response",
            `OSV returned unsupported vulnerability detail for ${vulnerabilityId}.`,
            false,
            vulnerabilityId,
          ),
        );
      }

      return resolveDetails(index + 1);
    };

    await resolveDetails(0);

    const vulnerabilityById = new Map(
      vulnerabilities.map((vulnerability) => [vulnerability.id, vulnerability]),
    );
    const queryEvidence: ExternalEvidence[] = queryResults.map((result) => ({
      id: osvQueryEvidenceId(sourceId, {
        packageName: result.packageName,
        version: result.version,
      }),
      kind: "external",
      sourceId,
      summary: result.complete
        ? `OSV exact-version query for ${result.packageName}@${result.version} completed with ${result.matches.length} known vulnerability match(es).`
        : `OSV exact-version query for ${result.packageName}@${result.version} returned ${result.matches.length} known vulnerability match(es), but pagination was incomplete.`,
      reference: osvQueryEvidenceReference({
        packageName: result.packageName,
        version: result.version,
      }),
      url: OSV_QUERY_BATCH_URL,
    }));
    const advisoryEvidence: ExternalEvidence[] = [...matchedPackagesByVulnerability.keys()]
      .toSorted(compareCodeUnits)
      .map((vulnerabilityId) => {
        const detail = vulnerabilityById.get(vulnerabilityId);

        return {
          id: osvEvidenceId(sourceId, vulnerabilityId),
          kind: "external",
          sourceId,
          summary: `OSV matched advisory ${vulnerabilityId} to an exact npm package version query`,
          reference: vulnerabilityId,
          url: osvVulnerabilityPageUrl(vulnerabilityId),
          ...(detail?.publishedAt === undefined ? {} : { publishedAt: detail.publishedAt }),
        };
      });
    const evidence = [...queryEvidence, ...advisoryEvidence].toSorted((left, right) =>
      compareCodeUnits(left.id, right.id),
    );

    const retrievedAt = validateObservedAt(this.#now());
    const source: AvailableDataSource | PartialDataSource =
      partialFailures.length === 0
        ? {
            id: sourceId,
            provider: OSV_PROVIDER_ID,
            status: "available",
            retrievedAt,
            reference: OSV_QUERY_BATCH_URL,
          }
        : {
            id: sourceId,
            provider: OSV_PROVIDER_ID,
            status: "partial",
            retrievedAt,
            reference: OSV_QUERY_BATCH_URL,
          };

    return {
      ok: true,
      data: {
        queryResults,
        vulnerabilities: vulnerabilities.toSorted((left, right) =>
          compareCodeUnits(left.id, right.id),
        ),
      },
      source,
      evidence,
      partialFailures,
    };
  }

  async #requestJson(
    url: string,
    init: RequestInit,
    codePrefix: "osv_query" | "osv_detail",
  ): Promise<JsonRequestResult> {
    if (url.length > CONTRACT_REFERENCE_MAX_LENGTH) {
      throw new OsvConfigurationError("OSV request URL exceeded the contract-safe reference limit");
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);

    try {
      const response = await this.#fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          failure: {
            code: `${codePrefix}_http_${response.status}`,
            message: `OSV returned HTTP ${response.status} during vulnerability metadata acquisition.`,
            retryable: isRetryableStatus(response.status),
          },
        };
      }

      const body = await readBoundedResponseText(response, this.#maxResponseBytes, () => {
        controller.abort();
      });

      try {
        return {
          ok: true,
          value: JSON.parse(body) as unknown,
        };
      } catch {
        return {
          ok: false,
          failure: {
            code: `${codePrefix}_invalid_json`,
            message: "OSV returned invalid JSON during vulnerability metadata acquisition.",
            retryable: false,
          },
        };
      }
    } catch (error) {
      if (error instanceof OsvConfigurationError) {
        throw error;
      }

      if (error instanceof ProviderResponseTooLargeError) {
        return {
          ok: false,
          failure: {
            code: `${codePrefix}_response_too_large`,
            message: `OSV response exceeded the ${this.#maxResponseBytes}-byte safety limit.`,
            retryable: false,
          },
        };
      }

      if (timedOut) {
        return {
          ok: false,
          failure: {
            code: `${codePrefix}_timeout`,
            message: "OSV request timed out during vulnerability metadata acquisition.",
            retryable: true,
          },
        };
      }

      return {
        ok: false,
        failure: {
          code: `${codePrefix}_request_failed`,
          message: "OSV request failed during vulnerability metadata acquisition.",
          retryable: true,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
