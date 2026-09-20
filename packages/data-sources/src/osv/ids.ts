import { stableIdHash } from "../stable-id.js";
import type { OsvPackageVersionQuery } from "./types.js";
import {
  OSV_API_BASE_URL,
  OSV_PROVIDER_ID,
  OSV_QUERY_BATCH_URL,
  OSV_VULNERABILITY_PAGE_BASE_URL,
} from "./types.js";

export function osvQueryKey(query: OsvPackageVersionQuery): string {
  return JSON.stringify([query.packageName, query.version]);
}

export function osvSourceId(queries: readonly OsvPackageVersionQuery[]): string {
  const canonicalQueries = [
    ...new Map(queries.map((query) => [osvQueryKey(query), query])).values(),
  ]
    .toSorted((left, right) => {
      if (left.packageName !== right.packageName) {
        return left.packageName < right.packageName ? -1 : 1;
      }

      return left.version < right.version ? -1 : left.version > right.version ? 1 : 0;
    })
    .map((query) => [query.packageName, query.version]);
  return `source-osv-${stableIdHash(JSON.stringify([OSV_PROVIDER_ID, canonicalQueries]))}`;
}

export function osvInvalidRequestSourceId(requestKey: string): string {
  return `source-osv-invalid-${stableIdHash(requestKey)}`;
}

export function osvEvidenceId(sourceId: string, vulnerabilityId: string): string {
  return `evidence-osv-${stableIdHash(JSON.stringify([sourceId, vulnerabilityId]))}`;
}

export function osvQueryEvidenceReference(query: OsvPackageVersionQuery): string {
  return `npm:${query.packageName}@${query.version}`;
}

export function osvQueryEvidenceId(sourceId: string, query: OsvPackageVersionQuery): string {
  return `evidence-osv-query-${stableIdHash(
    JSON.stringify([sourceId, query.packageName, query.version]),
  )}`;
}

export function osvFailureId(sourceId: string, code: string, context = ""): string {
  return `failure-osv-${stableIdHash(JSON.stringify([sourceId, code, context]))}`;
}

export function osvVulnerabilityApiUrl(vulnerabilityId: string): string {
  return new URL(`v1/vulns/${encodeURIComponent(vulnerabilityId)}`, OSV_API_BASE_URL).toString();
}

export function osvVulnerabilityPageUrl(vulnerabilityId: string): string {
  return new URL(encodeURIComponent(vulnerabilityId), OSV_VULNERABILITY_PAGE_BASE_URL).toString();
}

export { OSV_QUERY_BATCH_URL };
