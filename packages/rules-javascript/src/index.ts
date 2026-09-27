export {
  createDependencyInventoryEvidence,
  dependencyInventoryEvidenceId,
  dependencyInventoryFactId,
  dependencyInventoryRule,
} from "./dependency-inventory.js";

export {
  createResolvedDependencyEvidence,
  isSupportedLockfilePath,
  normalizeResolvedDependencies,
  resolvedDependency,
  resolvedDependencyEvidenceId,
  resolvedDependencyFactId,
  resolvedDependencyFactRule,
  SUPPORTED_LOCKFILE_PATHS,
} from "./lockfile.js";
export type {
  JavaScriptLockfileFile,
  JavaScriptPackageManager,
  JavaScriptResolvedDependency,
  JavaScriptResolvedDependencyIssue,
  JavaScriptResolvedDependencySnapshot,
  ResolvedDependencyIssueCode,
  ResolvedDependencyNormalization,
  SupportedLockfilePath,
} from "./lockfile.js";

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
export { dependencyOverlapFindingId, dependencyOverlapRule } from "./dependency-overlap.js";
export {
  frameworkToolDetectionFactId,
  frameworkToolDetectionRule,
} from "./framework-tool-detection.js";
export {
  createProjectConfigurationEvidence,
  projectConfigurationEvidenceId,
  projectConfigurationFactId,
  projectConfigurationRule,
} from "./project-configuration.js";
export { createJavaScriptProjectSnapshot, normalizePackageScripts } from "./project-snapshot.js";
export type {
  JavaScriptPackageScript,
  JavaScriptProjectSnapshot,
  JavaScriptProjectSnapshotOptions,
  JavaScriptStaticProjectFile,
} from "./project-snapshot.js";

export {
  babelSourceReferenceParser,
  isSupportedJavaScriptSourcePath,
  packageNameFromModuleSpecifier,
} from "./source-parser.js";
export type {
  JavaScriptSourceParseIssue,
  JavaScriptSourceParseResult,
  JavaScriptSourceReference,
  JavaScriptSourceReferenceKind,
  JavaScriptSourceReferenceParser,
} from "./source-parser.js";

export {
  createJavaScriptSourceUsageSnapshot,
  createSourceUsageEvidence,
  sourceUsageCoverageEvidenceId,
  sourceUsageFactId,
  sourceUsageFactRule,
  sourceUsageReferenceEvidenceId,
  withJavaScriptSourceUsage,
} from "./source-usage.js";
export type {
  JavaScriptDependencyReference,
  JavaScriptDependencyReferenceKind,
  JavaScriptSourceAcquisitionCoverage,
  JavaScriptSourceUsageIssue,
  JavaScriptSourceUsageSnapshot,
} from "./source-usage.js";

export {
  potentiallyUnnecessaryDependencyFindingId,
  potentiallyUnnecessaryDependencyRule,
} from "./unnecessary-dependency.js";

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

export {
  migrationOpportunityFindingId,
  migrationOpportunityRule,
} from "./migration-opportunity.js";
export { javascriptFindingPrioritizer } from "./priority-policy.js";
export { evidenceBackedRecommendationRule, recommendationId } from "./recommendations.js";
export {
  analysisCoverageFactId,
  analysisCoverageFactType,
  scoringCoverageFactRule,
} from "./scoring-coverage.js";

export { effectiveDependencyVersion } from "./rule-support.js";
export type { EffectiveDependencyVersion } from "./rule-support.js";

export { parseExactSemanticVersion } from "./semver.js";
export type { ParsedSemanticVersion } from "./semver.js";
export {
  createReadinessEvidence,
  projectReadinessFactRule,
  projectReadinessFindingRule,
} from "./project-readiness.js";
