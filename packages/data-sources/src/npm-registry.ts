import { IsoDateTimeSchema } from "@stacklens/contracts";
import type {
  AvailableDataSource,
  ExternalEvidence,
  PartialFailure,
  UnavailableDataSource,
} from "@stacklens/contracts";

import type { EvidenceProvider, ProviderFailure, ProviderResult } from "./provider.js";
import { stableIdHash } from "./stable-id.js";

export const NPM_REGISTRY_PROVIDER_ID = "npm-registry";
export const NPM_REGISTRY_BASE_URL = "https://registry.npmjs.org/";
export const NPM_REGISTRY_DEFAULT_TIMEOUT_MS = 8_000;
export const NPM_REGISTRY_DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

const NPM_REGISTRY_ACCEPT = "application/json";

export interface NpmPackageMetadataRequest {
  readonly packageName: string;
}

export interface NpmDistTag {
  readonly tag: string;
  readonly version: string;
}

export interface NpmPackageVersionMetadata {
  readonly version: string;
  readonly deprecatedMessage?: string;
  readonly publishedAt?: string;
}

export interface NpmRepositoryMetadata {
  readonly url: string;
  readonly type?: string;
  readonly directory?: string;
}

export interface NpmPackageMetadata {
  readonly packageName: string;
  readonly registryCreatedAt?: string;
  readonly registryModifiedAt?: string;
  readonly distTags: readonly NpmDistTag[];
  readonly versions: readonly NpmPackageVersionMetadata[];
  readonly repository?: NpmRepositoryMetadata;
}

export interface NpmRegistryAdapterOptions {
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

class NpmRegistryConfigurationError extends Error {}

class NpmRegistryResponseTooLargeError extends Error {}

class NpmRegistryPayloadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireUnpaddedString(
  value: unknown,
  label: string,
  maximumLength = 4_000,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value
  ) {
    throw new NpmRegistryPayloadError(
      `${label} must be a non-empty unpadded string no longer than ${maximumLength} characters`,
    );
  }

  return value;
}

function optionalUnpaddedString(
  value: unknown,
  label: string,
  maximumLength = 4_000,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireUnpaddedString(value, label, maximumLength);
}

function parseIsoTimestamp(value: unknown, label: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new NpmRegistryPayloadError(`${label} must be an ISO 8601 timestamp with an offset`);
  }

  return parsed.data;
}

function parseDistTags(value: unknown): readonly NpmDistTag[] {
  if (!isRecord(value)) {
    throw new NpmRegistryPayloadError("dist-tags must be an object");
  }

  return Object.entries(value)
    .map(([tag, version]) => ({
      tag: requireUnpaddedString(tag, "dist-tag name", 500),
      version: requireUnpaddedString(version, `dist-tag ${tag}`, 500),
    }))
    .toSorted((left, right) => left.tag.localeCompare(right.tag, "en", { sensitivity: "variant" }));
}

function parseVersionTimes(
  value: unknown,
  versionNames: readonly string[],
): {
  readonly createdAt?: string;
  readonly modifiedAt?: string;
  readonly publishedAtByVersion: ReadonlyMap<string, string>;
} {
  if (value === undefined) {
    return {
      publishedAtByVersion: new Map(),
    };
  }

  if (!isRecord(value)) {
    throw new NpmRegistryPayloadError("time must be an object when provided");
  }

  const publishedAtByVersion = new Map<string, string>();

  for (const version of versionNames) {
    if (value[version] !== undefined) {
      publishedAtByVersion.set(
        version,
        parseIsoTimestamp(value[version], `time.${version}`),
      );
    }
  }

  const createdAt =
    value.created === undefined ? undefined : parseIsoTimestamp(value.created, "time.created");
  const modifiedAt =
    value.modified === undefined ? undefined : parseIsoTimestamp(value.modified, "time.modified");

  return {
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(modifiedAt === undefined ? {} : { modifiedAt }),
    publishedAtByVersion,
  };
}

function parseVersions(
  value: unknown,
  publishedAtByVersion: ReadonlyMap<string, string>,
): readonly NpmPackageVersionMetadata[] {
  if (!isRecord(value)) {
    throw new NpmRegistryPayloadError("versions must be an object");
  }

  return Object.entries(value)
    .map(([versionKey, versionValue]) => {
      const version = requireUnpaddedString(versionKey, "version key", 500);

      if (!isRecord(versionValue)) {
        throw new NpmRegistryPayloadError(`versions.${version} must be an object`);
      }

      const declaredVersion = requireUnpaddedString(
        versionValue.version,
        `versions.${version}.version`,
        500,
      );

      if (declaredVersion !== version) {
        throw new NpmRegistryPayloadError(
          `versions.${version}.version must match its version key`,
        );
      }

      const deprecatedRaw = versionValue.deprecated;
      let deprecatedMessage: string | undefined;

      if (deprecatedRaw !== undefined) {
        if (typeof deprecatedRaw !== "string") {
          throw new NpmRegistryPayloadError(
            `versions.${version}.deprecated must be a string when provided`,
          );
        }

        const normalizedMessage = deprecatedRaw.trim();

        if (normalizedMessage.length > 4_000) {
          throw new NpmRegistryPayloadError(
            `versions.${version}.deprecated must not exceed 4000 characters`,
          );
        }

        if (normalizedMessage.length > 0) {
          deprecatedMessage = normalizedMessage;
        }
      }

      const publishedAt = publishedAtByVersion.get(version);

      return {
        version,
        ...(deprecatedMessage === undefined ? {} : { deprecatedMessage }),
        ...(publishedAt === undefined ? {} : { publishedAt }),
      };
    })
    .toSorted((left, right) =>
      left.version.localeCompare(right.version, "en", { sensitivity: "variant" }),
    );
}

function parseRepository(value: unknown): NpmRepositoryMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return {
      url: requireUnpaddedString(value, "repository", 2_000),
    };
  }

  if (!isRecord(value)) {
    throw new NpmRegistryPayloadError("repository must be a string or object when provided");
  }

  const url = requireUnpaddedString(value.url, "repository.url", 2_000);
  const type = optionalUnpaddedString(value.type, "repository.type", 200);
  const directory = optionalUnpaddedString(value.directory, "repository.directory", 1_000);

  return {
    url,
    ...(type === undefined ? {} : { type }),
    ...(directory === undefined ? {} : { directory }),
  };
}

function parseNpmPackageMetadata(
  value: unknown,
  requestedPackageName: string,
): NpmPackageMetadata {
  if (!isRecord(value)) {
    throw new NpmRegistryPayloadError("npm Registry response must be an object");
  }

  const packageName = requireUnpaddedString(value.name, "name", 500);

  if (packageName !== requestedPackageName) {
    throw new NpmRegistryPayloadError(
      `npm Registry response name ${packageName} did not match requested package ${requestedPackageName}`,
    );
  }

  const versionsValue = value.versions;

  if (!isRecord(versionsValue)) {
    throw new NpmRegistryPayloadError("versions must be an object");
  }

  const versionNames = Object.keys(versionsValue).map((version) =>
    requireUnpaddedString(version, "version key", 500),
  );
  const time = parseVersionTimes(value.time, versionNames);
  const versions = parseVersions(versionsValue, time.publishedAtByVersion);
  const distTags = parseDistTags(value["dist-tags"]);
  const knownVersions = new Set(versions.map((version) => version.version));

  const latestTag = distTags.find((tag) => tag.tag === "latest");

  if (latestTag === undefined) {
    throw new NpmRegistryPayloadError("dist-tags.latest must be present");
  }

  for (const tag of distTags) {
    if (!knownVersions.has(tag.version)) {
      throw new NpmRegistryPayloadError(
        `dist-tag ${tag.tag} references unknown version ${tag.version}`,
      );
    }
  }

  const repository = parseRepository(value.repository);

  return {
    packageName,
    ...(time.createdAt === undefined ? {} : { registryCreatedAt: time.createdAt }),
    ...(time.modifiedAt === undefined ? {} : { registryModifiedAt: time.modifiedAt }),
    distTags,
    versions,
    ...(repository === undefined ? {} : { repository }),
  };
}

function packageObservationKey(packageName: string): string {
  return stableIdHash(`${NPM_REGISTRY_PROVIDER_ID}\0${packageName}`);
}

export function npmRegistrySourceId(packageName: string): string {
  return `source-npm-${packageObservationKey(packageName)}`;
}

export function npmRegistryEvidenceId(packageName: string): string {
  return `evidence-npm-${packageObservationKey(packageName)}`;
}

export function npmRegistryPackageUrl(packageName: string): string {
  return new URL(encodeURIComponent(packageName), NPM_REGISTRY_BASE_URL).toString();
}

function validatePackageName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 500 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new NpmRegistryConfigurationError(`${label} must be a positive safe integer`);
  }

  return value;
}

function validateObservedAt(value: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new NpmRegistryConfigurationError("now() must return an ISO 8601 timestamp with an offset");
  }

  return parsed.data;
}

async function readBoundedResponseText(
  response: Response,
  maxResponseBytes: number,
  onLimitExceeded: () => void,
): Promise<string> {
  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const parsedLength = Number(contentLength);

    if (Number.isFinite(parsedLength) && parsedLength > maxResponseBytes) {
      onLimitExceeded();
      throw new NpmRegistryResponseTooLargeError(
        `npm Registry response exceeded the ${maxResponseBytes}-byte limit`,
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maxResponseBytes) {
      onLimitExceeded();
      throw new NpmRegistryResponseTooLargeError(
        `npm Registry response exceeded the ${maxResponseBytes}-byte limit`,
      );
    }

    parts.push(decoder.decode(result.value, { stream: true }));
  }

  parts.push(decoder.decode());

  return parts.join("");
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
    id: `failure-npm-${packageObservationKey(packageName)}-${stableIdHash(code)}`,
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

export class NpmRegistryAdapter
  implements EvidenceProvider<NpmPackageMetadataRequest, NpmPackageMetadata>
{
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

    if (!validatePackageName(packageName)) {
      const attemptedAt = validateObservedAt(this.#now());

      return createSourceFailure(
        typeof packageName === "string" ? packageName : String(packageName),
        attemptedAt,
        "npm_invalid_package_name",
        "npm Registry package names must be non-empty, unpadded strings without control characters.",
        false,
      );
    }

    const endpoint = npmRegistryPackageUrl(packageName);
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
        const attemptedAt = validateObservedAt(this.#now());

        return createSourceFailure(
          packageName,
          attemptedAt,
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
        const attemptedAt = validateObservedAt(this.#now());

        return createSourceFailure(
          packageName,
          attemptedAt,
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

        const attemptedAt = validateObservedAt(this.#now());

        return createSourceFailure(
          packageName,
          attemptedAt,
          "npm_invalid_response",
          `npm Registry returned an unsupported metadata shape for ${packageName}: ${error.message}`,
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
      const attemptedAt = validateObservedAt(this.#now());

      if (error instanceof NpmRegistryResponseTooLargeError) {
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
