import { stableIdHash } from "../stable-id.js";
import type { OsvPackageVersionQuery } from "./types.js";
import {
  OSV_PROVIDER_ID,
  OSV_QUERY_BATCH_URL,
  OSV_VULNERABILITY_PAGE_BASE_URL,
} from "./types.js";

export function osvQueryKey(query: OsvPackageVersionQuery): string {
  return `${query.packageName}\\0${query.version}`;
}

export function osvSourceId(queries: readonly OsvPackageVersionQuery[]): string {
  const canonical = queries.map(osvQueryKey).join("\\n");
  return `source-osv-${stableIdHash(`${OSV_PROVIDER_ID}\\0${canonical}`)}`;
}

export function osvInvalidRequestSourceId(requestKey: string): string {
  return `source-osv-invalid-${stableIdHash(requestKey)}`;
}

export function osvEvidenceId(sourceId: string, vulnerabilityId: string): string {
  return `evidence-osv-${stableIdHash(`${sourceId}\\0${vulnerabilityId}`)}`;
}

export function osvFailureId(sourceId: string, code: string, context = ""): string {
  return `failure-osv-${stableIdHash(`${sourceId}\\0${code}\\0${context}`)}`;
}

export function osvVulnerabilityApiUrl(vulnerabilityId: string): string {
  return new URL(`v1/vulns/${encodeURIComponent(vulnerabilityId)}`, "https://api.osv.dev/").toString();
}

export function osvVulnerabilityPageUrl(vulnerabilityId: string): string {
  return new URL(
    encodeURIComponent(vulnerabilityId),
    OSV_VULNERABILITY_PAGE_BASE_URL,
  ).toString();
}

export { OSV_QUERY_BATCH_URL };
