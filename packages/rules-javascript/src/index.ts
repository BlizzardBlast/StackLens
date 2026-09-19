export {
  createDependencyInventoryEvidence,
  dependencyInventoryEvidenceId,
  dependencyInventoryFactId,
  dependencyInventoryRule,
} from "./dependency-inventory.js";

export { normalizePackageManifest, PACKAGE_DEPENDENCY_GROUPS } from "./manifest.js";
export type {
  NormalizedDependencyDeclaration,
  NormalizedPackageManifest,
  PackageDependencyGroup,
} from "./manifest.js";

export {
  deprecatedDependencyFindingId,
  deprecatedDependencyRule,
} from "./deprecated-dependency.js";
export { npmRegistryHealthFactId, npmRegistryHealthFactRule } from "./npm-registry-health.js";
export { outdatedDependencyFindingId, outdatedDependencyRule } from "./outdated-dependency.js";
export { knownVulnerabilityFindingId, knownVulnerabilityRule } from "./known-vulnerability.js";

export type {
  JavaScriptAnalysisMetadata,
  JavaScriptNpmDistTag,
  JavaScriptNpmMetadata,
  JavaScriptNpmPackageSnapshot,
  JavaScriptNpmPackageVersion,
  JavaScriptOsvAffectedPackage,
  JavaScriptOsvMetadata,
  JavaScriptOsvQueryResult,
  JavaScriptOsvSeverity,
  JavaScriptOsvSnapshot,
  JavaScriptOsvVulnerability,
  JavaScriptOsvVulnerabilityMatch,
} from "./analysis-metadata.js";
