import type { AnalyzerDefinition } from "@stacklens/analyzer-core";
import {
  dependencyInventoryRule,
  dependencyOverlapRule,
  deprecatedDependencyRule,
  evidenceBackedRecommendationRule,
  frameworkToolDetectionRule,
  javascriptFindingPrioritizer,
  knownVulnerabilityRule,
  migrationOpportunityRule,
  npmRegistryHealthFactRule,
  outdatedDependencyRule,
  potentiallyUnnecessaryDependencyRule,
  projectConfigurationRule,
  projectReadinessFindingRule,
  resolvedDependencyFactRule,
  sourceUsageFactRule,
  workspaceInspectionRule,
  scopeFactRule,
  scopeFindingRule,
  scopeRecommendationRule,
} from "@stacklens/rules-javascript";
import type {
  JavaScriptAnalysisMetadata,
  JavaScriptProjectSnapshot,
} from "@stacklens/rules-javascript";
import { stackHealthScorer } from "@stacklens/scoring";

export const PRODUCTION_JAVASCRIPT_ANALYZER_VERSION = "javascript-production-v5";
export const PRODUCTION_JAVASCRIPT_RULE_SET_VERSION = "javascript-rules-v5";

export const productionJavaScriptAnalyzer = {
  reportSchemaVersion: "2.0.0",
  version: PRODUCTION_JAVASCRIPT_ANALYZER_VERSION,
  ruleSet: {
    version: PRODUCTION_JAVASCRIPT_RULE_SET_VERSION,
    factRules: [
      ...[
        dependencyInventoryRule,
        frameworkToolDetectionRule,
        npmRegistryHealthFactRule,
        projectConfigurationRule,
        resolvedDependencyFactRule,
        sourceUsageFactRule,
      ].map(scopeFactRule),
      workspaceInspectionRule,
    ],
    findingRules: [
      dependencyOverlapRule,
      deprecatedDependencyRule,
      knownVulnerabilityRule,
      migrationOpportunityRule,
      outdatedDependencyRule,
      potentiallyUnnecessaryDependencyRule,
      projectReadinessFindingRule,
    ].map(scopeFindingRule),
    prioritizer: javascriptFindingPrioritizer,
    recommendationRules: [evidenceBackedRecommendationRule].map(scopeRecommendationRule),
  },
  scorer: stackHealthScorer,
} satisfies AnalyzerDefinition<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>;

/** Manifest-only composition shares scoring policy; absent repository/provider evidence stays unknown. */
export const quickManifestJavaScriptAnalyzer = {
  reportSchemaVersion: "2.0.0",
  version: "javascript-quick-manifest-v5",
  ruleSet: {
    version: "javascript-quick-manifest-rules-v5",
    factRules: [
      scopeFactRule(dependencyInventoryRule),
      scopeFactRule(frameworkToolDetectionRule),
      workspaceInspectionRule,
    ],
    findingRules: [scopeFindingRule(dependencyOverlapRule)],
    prioritizer: javascriptFindingPrioritizer,
    recommendationRules: [scopeRecommendationRule(evidenceBackedRecommendationRule)],
  },
  scorer: stackHealthScorer,
} satisfies AnalyzerDefinition<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>;
