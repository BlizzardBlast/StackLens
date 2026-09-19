export const NPM_REGISTRY_PROVIDER_ID = "npm-registry";
export const NPM_REGISTRY_BASE_URL = "https://registry.npmjs.org/";
export const NPM_REGISTRY_DEFAULT_TIMEOUT_MS = 8_000;
export const NPM_REGISTRY_DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

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
