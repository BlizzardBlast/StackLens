import { IsoDateTimeSchema } from "@stacklens/contracts";
import type {
  AvailableDataSource,
  ExternalEvidence,
  PartialFailure,
  UnavailableDataSource,
} from "@stacklens/contracts";

import { ProviderResponseTooLargeError, readBoundedResponseText } from "../http.js";
import { isValidNpmPackageName, NPM_PACKAGE_NAME_MAX_LENGTH } from "../npm-package.js";
import type { EvidenceProvider, ProviderFailure, ProviderResult } from "../provider.js";
import {
  npmRegistryEvidenceId,
  npmRegistryFailureId,
  npmRegistryPackageUrl,
  npmRegistrySourceId,
} from "./ids.js";
import { NpmRegistryPayloadError, parseNpmPackageMetadata } from "./metadata.js";
import {
  NPM_REGISTRY_DEFAULT_MAX_RESPONSE_BYTES,
  NPM_REGISTRY_DEFAULT_TIMEOUT_MS,
  NPM_REGISTRY_PROVIDER_ID,
} from "./types.js";
import type {
  NpmPackageMetadata,
  NpmPackageMetadataRequest,
  NpmRegistryAdapterOptions,
} from "./types.js";

const NPM_REGISTRY_ACCEPT = "application/json";
const CONTRACT_REFERENCE_MAX_LENGTH = 1_000;

class NpmRegistryConfigurationError extends Error {}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new NpmRegistryConfigurationError(`${label} must be a positive safe integer`);
  }

  return value;
}

function validateObservedAt(value: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new NpmRegistryConfigurationError(
      "now() must return an ISO 8601 timestamp with an offset",
    );
  }

  return parsed.data;
}

function createSourceFailure(
  packageName: string,
  attemptedAt: string,
  code: string,
  message: string,
  retryable: boolean,
  reference?: string,
): ProviderFailure {
  const sourceId = npmRegistrySourceId(packageName);

  const source: UnavailableDataSource = {
    id: sourceId,
    provider: NPM_REGISTRY_PROVIDER_ID,
    status: "unavailable",
    attemptedAt,
    ...(reference === undefined ? {} : { reference }),
  };

  const failure: PartialFailure = {
    id: npmRegistryFailureId(packageName, code),
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

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export class NpmRegistryAdapter implements EvidenceProvider<
  NpmPackageMetadataRequest,
  NpmPackageMetadata
> {
  readonly id = NPM_REGISTRY_PROVIDER_ID;

  readonly #fetchImpl: typeof fetch;
  readonly #now: () => string;
  readonly #timeoutMs: number;
  readonly #maxResponseBytes: number;

  constructor(options: NpmRegistryAdapterOptions = {}) {
    this.#fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#timeoutMs = validatePositiveInteger(
      options.timeoutMs ?? NPM_REGISTRY_DEFAULT_TIMEOUT_MS,
      "timeoutMs",
    );
    this.#maxResponseBytes = validatePositiveInteger(
      options.maxResponseBytes ?? NPM_REGISTRY_DEFAULT_MAX_RESPONSE_BYTES,
      "maxResponseBytes",
    );
  }

  async fetch(request: NpmPackageMetadataRequest): Promise<ProviderResult<NpmPackageMetadata>> {
    const packageName = request.packageName;

    if (!isValidNpmPackageName(packageName)) {
      const attemptedAt = validateObservedAt(this.#now());

      return createSourceFailure(
        typeof packageName === "string" ? packageName : "invalid-package-name",
        attemptedAt,
        "npm_invalid_package_name",
        "npm Registry package names must be non-empty, unpadded strings no longer than 214 characters and without control characters.",
        false,
      );
    }

    const endpoint = npmRegistryPackageUrl(packageName);

    if (endpoint.length > CONTRACT_REFERENCE_MAX_LENGTH) {
      return createSourceFailure(
        packageName,
        validateObservedAt(this.#now()),
        "npm_invalid_package_name",
        "npm Registry package names must produce a contract-safe registry reference.",
        false,
      );
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);

    try {
      const response = await this.#fetchImpl(endpoint, {
        method: "GET",
        headers: {
          accept: NPM_REGISTRY_ACCEPT,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return createSourceFailure(
          packageName,
          validateObservedAt(this.#now()),
          `npm_http_${response.status}`,
          `npm Registry returned HTTP ${response.status} for ${packageName}.`,
          isRetryableStatus(response.status),
          endpoint,
        );
      }

      const body = await readBoundedResponseText(response, this.#maxResponseBytes, () => {
        controller.abort();
      });

      let parsedBody: unknown;

      try {
        parsedBody = JSON.parse(body) as unknown;
      } catch {
        return createSourceFailure(
          packageName,
          validateObservedAt(this.#now()),
          "npm_invalid_json",
          `npm Registry returned invalid JSON for ${packageName}.`,
          false,
          endpoint,
        );
      }

      let data: NpmPackageMetadata;

      try {
        data = parseNpmPackageMetadata(parsedBody, packageName);
      } catch (error) {
        if (!(error instanceof NpmRegistryPayloadError)) {
          throw error;
        }

        return createSourceFailure(
          packageName,
          validateObservedAt(this.#now()),
          "npm_invalid_response",
          `npm Registry returned an unsupported metadata shape for ${packageName}.`,
          false,
          endpoint,
        );
      }

      const retrievedAt = validateObservedAt(this.#now());
      const source: AvailableDataSource = {
        id: npmRegistrySourceId(packageName),
        provider: NPM_REGISTRY_PROVIDER_ID,
        status: "available",
        retrievedAt,
        reference: endpoint,
      };
      const evidence: ExternalEvidence = {
        id: npmRegistryEvidenceId(packageName),
        kind: "external",
        sourceId: source.id,
        summary: `npm Registry package metadata for ${packageName}`,
        reference: endpoint,
        url: endpoint,
      };

      return {
        ok: true,
        data,
        source,
        evidence: [evidence],
        partialFailures: [],
      };
    } catch (error) {
      if (error instanceof NpmRegistryConfigurationError) {
        throw error;
      }

      const attemptedAt = validateObservedAt(this.#now());

      if (error instanceof ProviderResponseTooLargeError) {
        return createSourceFailure(
          packageName,
          attemptedAt,
          "npm_response_too_large",
          error.message,
          false,
          endpoint,
        );
      }

      if (timedOut) {
        return createSourceFailure(
          packageName,
          attemptedAt,
          "npm_request_timeout",
          `npm Registry request timed out for ${packageName}.`,
          true,
          endpoint,
        );
      }

      return createSourceFailure(
        packageName,
        attemptedAt,
        "npm_request_failed",
        `npm Registry request failed for ${packageName}.`,
        true,
        endpoint,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
