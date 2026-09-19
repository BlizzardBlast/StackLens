export const OSV_PROVIDER_ID = "osv";
export const OSV_API_BASE_URL = "https://api.osv.dev/";
export const OSV_QUERY_BATCH_URL = "https://api.osv.dev/v1/querybatch";
export const OSV_VULNERABILITY_PAGE_BASE_URL = "https://osv.dev/vulnerability/";
export const OSV_DEFAULT_TIMEOUT_MS = 8_000;
export const OSV_DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
export const OSV_DEFAULT_MAX_QUERIES = 100;
export const OSV_DEFAULT_MAX_PAGINATION_ROUNDS = 20;

export interface OsvPackageVersionQuery {
  readonly packageName: string;
  readonly version: string;
}

export interface OsvVulnerabilityRequest {
  readonly queries: readonly OsvPackageVersionQuery[];
}

export interface OsvQueryVulnerabilityMatch {
  readonly id: string;
  readonly modifiedAt: string;
}

export interface OsvPackageVersionResult {
  readonly packageName: string;
  readonly version: string;
  readonly matches: readonly OsvQueryVulnerabilityMatch[];
  readonly complete: boolean;
}

export interface OsvSeverity {
  readonly type: string;
  readonly score: string;
  readonly source?: string;
}

export interface OsvReference {
  readonly type: string;
  readonly url: string;
}

export interface OsvAffectedPackage {
  readonly packageName: string;
  readonly ecosystem: string;
  readonly purl?: string;
  readonly versions: readonly string[];
  readonly severities: readonly OsvSeverity[];
}

export interface OsvVulnerabilityRecord {
  readonly id: string;
  readonly schemaVersion?: string;
  readonly summary?: string;
  readonly modifiedAt: string;
  readonly publishedAt?: string;
  readonly withdrawnAt?: string;
  readonly aliases: readonly string[];
  readonly related: readonly string[];
  readonly upstream: readonly string[];
  readonly severities: readonly OsvSeverity[];
  readonly references: readonly OsvReference[];
  readonly affected: readonly OsvAffectedPackage[];
}

export interface OsvVulnerabilitySnapshot {
  readonly queryResults: readonly OsvPackageVersionResult[];
  readonly vulnerabilities: readonly OsvVulnerabilityRecord[];
}

export interface OsvAdapterOptions {
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  readonly maxQueries?: number;
  readonly maxPaginationRounds?: number;
}
