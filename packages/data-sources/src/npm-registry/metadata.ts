import { IsoDateTimeSchema } from "@stacklens/contracts";

import type {
  NpmDistTag,
  NpmPackageMetadata,
  NpmPackageVersionMetadata,
  NpmRepositoryMetadata,
} from "./types.js";

export class NpmRegistryPayloadError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireUnpaddedString(value: unknown, label: string, maximumLength = 4_000): string {
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
    .toSorted((left, right) => compareCodeUnits(left.tag, right.tag));
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
      publishedAtByVersion.set(version, parseIsoTimestamp(value[version], `time.${version}`));
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
  value: Record<string, unknown>,
  publishedAtByVersion: ReadonlyMap<string, string>,
): readonly NpmPackageVersionMetadata[] {
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
        throw new NpmRegistryPayloadError(`versions.${version}.version must match its version key`);
      }

      const deprecatedRaw = versionValue.deprecated;
      let deprecatedMessage: string | undefined;

      if (deprecatedRaw !== undefined && deprecatedRaw !== false) {
        if (typeof deprecatedRaw !== "string") {
          throw new NpmRegistryPayloadError(
            `versions.${version}.deprecated must be a string or false when provided`,
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
    .toSorted((left, right) => compareCodeUnits(left.version, right.version));
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

export function parseNpmPackageMetadata(
  value: unknown,
  requestedPackageName: string,
): NpmPackageMetadata {
  if (!isRecord(value)) {
    throw new NpmRegistryPayloadError("npm Registry response must be an object");
  }

  const packageName = requireUnpaddedString(value.name, "name", 500);

  if (packageName !== requestedPackageName) {
    throw new NpmRegistryPayloadError(
      `npm Registry response name did not match requested package ${requestedPackageName}`,
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
        `dist-tag ${tag.tag} references a version absent from versions`,
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
