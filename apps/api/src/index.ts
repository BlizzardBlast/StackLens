export { createManifestFingerprint } from "./manifest-fingerprint.js";

export { validateQuickManifestInput } from "./manifest-input.js";
export type {
  QuickManifestInput,
  QuickManifestValidationError,
  QuickManifestValidationErrorCode,
  QuickManifestValidationResult,
} from "./manifest-input.js";

export {
  analyzeQuickManifest,
  QUICK_MANIFEST_INPUT_LIMITATION_ID,
  QUICK_MANIFEST_METADATA_LIMITATION_ID,
} from "./quick-manifest-analysis.js";
export type {
  QuickManifestAnalysisCommand,
  QuickManifestAnalysisDependencies,
  QuickManifestAnalysisResult,
} from "./quick-manifest-analysis.js";

export {
  PRODUCTION_JAVASCRIPT_ANALYZER_VERSION,
  PRODUCTION_JAVASCRIPT_RULE_SET_VERSION,
  productionJavaScriptAnalyzer,
} from "./production-javascript-analyzer.js";

export {
  analyzePublicGitHubRepository,
  REPOSITORY_ANALYSIS_MAX_METADATA_PACKAGES,
  REPOSITORY_ANALYSIS_MAX_OSV_QUERIES,
  REPOSITORY_METADATA_LIMITATION_ID,
  REPOSITORY_OSV_LIMITATION_ID,
} from "./repository-analysis.js";
export type {
  RepositoryAnalysisCommand,
  RepositoryAnalysisDependencies,
  RepositoryAnalysisError,
  RepositoryAnalysisErrorCode,
  RepositoryAnalysisProgress,
  RepositoryAnalysisProgressPhase,
  RepositoryAnalysisProgressStatus,
  RepositoryAnalysisResult,
} from "./repository-analysis.js";
