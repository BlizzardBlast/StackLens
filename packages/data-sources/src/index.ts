export {
  NPM_REGISTRY_BASE_URL,
  NPM_REGISTRY_DEFAULT_MAX_RESPONSE_BYTES,
  NPM_REGISTRY_DEFAULT_TIMEOUT_MS,
  NPM_REGISTRY_PROVIDER_ID,
  NpmRegistryAdapter,
  npmRegistryEvidenceId,
  npmRegistryPackageUrl,
  npmRegistrySourceId,
} from "./npm-registry.js";
export type {
  NpmDistTag,
  NpmPackageMetadata,
  NpmPackageMetadataRequest,
  NpmPackageVersionMetadata,
  NpmRegistryAdapterOptions,
  NpmRepositoryMetadata,
} from "./npm-registry.js";

export type {
  EvidenceProvider,
  ProviderFailure,
  ProviderResult,
  ProviderSuccess,
} from "./provider.js";
