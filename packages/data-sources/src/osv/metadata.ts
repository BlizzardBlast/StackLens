import { IsoDateTimeSchema } from "@stacklens/contracts";

import type {
  OsvAffectedPackage,
  OsvQueryVulnerabilityMatch,
  OsvReference,
  OsvSeverity,
  OsvVulnerabilityRecord,
} from "./types.js";

export class OsvPayloadError extends Error {}

export interface ParsedBatchResult {
  readonly matches: readonly OsvQueryVulnerabilityMatch[];
  readonly nextPageToken?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireString(value: unknown, label: string, maxLength = 4_000): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    throw new OsvPayloadError(`${label} must be a non-empty unpadded string`);
  }

  return value;
}

function optionalString(
  value: unknown,
  label: string,
  maxLength = 4_000,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireString(value, label, maxLength);
}

function requireAdvisoryId(value: unknown, label: string): string {
  const id = requireString(value, label, 200);

  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(id)) {
    throw new OsvPayloadError(`${label} contains unsupported advisory-id characters`);
  }

  return id;
}

function parseTimestamp(value: unknown, label: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new OsvPayloadError(`${label} must be an ISO 8601 timestamp with an offset`);
  }

  return parsed.data;
}

function optionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseTimestamp(value, label);
}

function parseStringArray(value: unknown, label: string): readonly string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OsvPayloadError(`${label} must be an array when provided`);
  }

  return [...new Set(value.map((item, index) => requireString(item, `${label}[${index}]`, 500)))]
    .toSorted(compareCodeUnits);
}

function parseSeverity(value: unknown, label: string): readonly OsvSeverity[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OsvPayloadError(`${label} must be an array when provided`);
  }

  const normalized = value.map((item, index) => {
    if (!isRecord(item)) {
      throw new OsvPayloadError(`${label}[${index}] must be an object`);
    }

    const type = requireString(item.type, `${label}[${index}].type`, 200);
    const score = requireString(item.score, `${label}[${index}].score`, 4_000);
    const source = optionalString(item.source, `${label}[${index}].source`, 500);

    return {
      type,
      score,
      ...(source === undefined ? {} : { source }),
    };
  });

  return normalized.toSorted((left, right) => {
    const typeOrder = compareCodeUnits(left.type, right.type);

    if (typeOrder !== 0) {
      return typeOrder;
    }

    const scoreOrder = compareCodeUnits(left.score, right.score);

    if (scoreOrder !== 0) {
      return scoreOrder;
    }

    return compareCodeUnits(left.source ?? "", right.source ?? "");
  });
}

function parseReferences(value: unknown): readonly OsvReference[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OsvPayloadError("references must be an array when provided");
  }

  return value
    .map((item, index) => {
      if (!isRecord(item)) {
        throw new OsvPayloadError(`references[${index}] must be an object`);
      }

      const type = requireString(item.type, `references[${index}].type`, 200);
      const url = requireString(item.url, `references[${index}].url`, 2_000);
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(url);
      } catch {
        throw new OsvPayloadError(`references[${index}].url must be an absolute URL`);
      }

      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new OsvPayloadError(`references[${index}].url must use HTTP or HTTPS`);
      }

      return {
        type,
        url: parsedUrl.toString(),
      };
    })
    .toSorted((left, right) => {
      const typeOrder = compareCodeUnits(left.type, right.type);
      return typeOrder === 0 ? compareCodeUnits(left.url, right.url) : typeOrder;
    });
}

function parseAffected(value: unknown): readonly OsvAffectedPackage[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OsvPayloadError("affected must be an array when provided");
  }

  return value
    .map((item, index) => {
      if (!isRecord(item) || !isRecord(item.package)) {
        throw new OsvPayloadError(`affected[${index}].package must be an object`);
      }

      const packageName = requireString(
        item.package.name,
        `affected[${index}].package.name`,
        500,
      );
      const ecosystem = requireString(
        item.package.ecosystem,
        `affected[${index}].package.ecosystem`,
        200,
      );
      const purl = optionalString(item.package.purl, `affected[${index}].package.purl`, 1_000);
      const versions = parseStringArray(item.versions, `affected[${index}].versions`);
      const severities = parseSeverity(item.severity, `affected[${index}].severity`);

      return {
        packageName,
        ecosystem,
        ...(purl === undefined ? {} : { purl }),
        versions,
        severities,
      };
    })
    .toSorted((left, right) => {
      const ecosystemOrder = compareCodeUnits(left.ecosystem, right.ecosystem);

      if (ecosystemOrder !== 0) {
        return ecosystemOrder;
      }

      const packageOrder = compareCodeUnits(left.packageName, right.packageName);

      if (packageOrder !== 0) {
        return packageOrder;
      }

      return compareCodeUnits(left.purl ?? "", right.purl ?? "");
    });
}

export function parseOsvBatchResponse(
  value: unknown,
  expectedResultCount: number,
): readonly ParsedBatchResult[] {
  if (!isRecord(value) || !Array.isArray(value.results)) {
    throw new OsvPayloadError("OSV batch response must contain a results array");
  }

  if (value.results.length !== expectedResultCount) {
    throw new OsvPayloadError("OSV batch response result count did not match the request");
  }

  return value.results.map((item, resultIndex) => {
    if (!isRecord(item)) {
      throw new OsvPayloadError(`results[${resultIndex}] must be an object`);
    }

    const vulnsValue = item.vulns;
    const matches: OsvQueryVulnerabilityMatch[] = [];

    if (vulnsValue !== undefined) {
      if (!Array.isArray(vulnsValue)) {
        throw new OsvPayloadError(`results[${resultIndex}].vulns must be an array`);
      }

      for (const [vulnerabilityIndex, vulnerability] of vulnsValue.entries()) {
        if (!isRecord(vulnerability)) {
          throw new OsvPayloadError(
            `results[${resultIndex}].vulns[${vulnerabilityIndex}] must be an object`,
          );
        }

        matches.push({
          id: requireAdvisoryId(
            vulnerability.id,
            `results[${resultIndex}].vulns[${vulnerabilityIndex}].id`,
          ),
          modifiedAt: parseTimestamp(
            vulnerability.modified,
            `results[${resultIndex}].vulns[${vulnerabilityIndex}].modified`,
          ),
        });
      }
    }

    const deduplicated = new Map<string, OsvQueryVulnerabilityMatch>();

    for (const match of matches) {
      const existing = deduplicated.get(match.id);

      if (
        existing === undefined ||
        Date.parse(match.modifiedAt) > Date.parse(existing.modifiedAt)
      ) {
        deduplicated.set(match.id, match);
      }
    }

    const nextPageToken = optionalString(
      item.next_page_token,
      `results[${resultIndex}].next_page_token`,
      4_000,
    );

    return {
      matches: [...deduplicated.values()].toSorted((left, right) =>
        compareCodeUnits(left.id, right.id),
      ),
      ...(nextPageToken === undefined ? {} : { nextPageToken }),
    };
  });
}

export function parseOsvVulnerability(
  value: unknown,
  expectedId: string,
  matchedPackageNames: ReadonlySet<string>,
): OsvVulnerabilityRecord {
  if (!isRecord(value)) {
    throw new OsvPayloadError("OSV vulnerability response must be an object");
  }

  const id = requireAdvisoryId(value.id, "id");

  if (id !== expectedId) {
    throw new OsvPayloadError("OSV vulnerability response id did not match the requested id");
  }

  const affected = parseAffected(value.affected);
  const hasMatchedNpmPackage = affected.some(
    (entry) => entry.ecosystem === "npm" && matchedPackageNames.has(entry.packageName),
  );

  if (!hasMatchedNpmPackage) {
    throw new OsvPayloadError(
      "OSV vulnerability detail did not contain an affected npm package matching the batch query",
    );
  }

  const schemaVersion = optionalString(value.schema_version, "schema_version", 100);
  const summary = optionalString(value.summary, "summary", 2_000);
  const modifiedAt = parseTimestamp(value.modified, "modified");
  const publishedAt = optionalTimestamp(value.published, "published");
  const withdrawnAt = optionalTimestamp(value.withdrawn, "withdrawn");

  return {
    id,
    ...(schemaVersion === undefined ? {} : { schemaVersion }),
    ...(summary === undefined ? {} : { summary }),
    modifiedAt,
    ...(publishedAt === undefined ? {} : { publishedAt }),
    ...(withdrawnAt === undefined ? {} : { withdrawnAt }),
    aliases: parseStringArray(value.aliases, "aliases"),
    related: parseStringArray(value.related, "related"),
    upstream: parseStringArray(value.upstream, "upstream"),
    severities: parseSeverity(value.severity, "severity"),
    references: parseReferences(value.references),
    affected,
  };
}
