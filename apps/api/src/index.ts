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
  QUICK_MANIFEST_ANALYZER_VERSION,
  QUICK_MANIFEST_RULE_SET_VERSION,
  QUICK_MANIFEST_SCORING_VERSION,
  quickManifestAnalyzer,
} from "./quick-manifest-analyzer.js";

export {
  QuickManifestAnalysisRequestSchema,
  QuickManifestAnalysisResponseSchema,
  registerQuickManifestAnalysisRoutes,
} from "./quick-manifest-http.js";
export type { QuickManifestAnalysisHttpDependencies } from "./quick-manifest-http.js";

export { readRepositoryAnalysis, submitRepositoryAnalysis } from "./repository-analysis.js";
export type {
  RepositoryAnalysisApplicationDependencies,
  RepositoryAnalysisSnapshot,
  RepositoryAnalysisValidationError,
  SubmitRepositoryAnalysisCommand,
  SubmitRepositoryAnalysisResult,
} from "./repository-analysis.js";

export { ApiErrorSchema, registerRepositoryAnalysisRoutes } from "./repository-analysis-http.js";
export type { RepositoryAnalysisHttpDependencies } from "./repository-analysis-http.js";

export { createStackLensApi } from "./server.js";
export type { StackLensApiOptions } from "./server.js";

export { createStackLensApiRuntime } from "./runtime.js";
export type { StackLensApiRuntime, StackLensApiRuntimeOptions } from "./runtime.js";
