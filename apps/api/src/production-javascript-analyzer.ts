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
  scoringCoverageFactRule,
  sourceUsageFactRule,
} from "@stacklens/rules-javascript";
import type {
  JavaScriptAnalysisMetadata,
  JavaScriptProjectSnapshot,
} from "@stacklens/rules-javascript";
import { stackHealthScorer } from "@stacklens/scoring";

export const PRODUCTION_JAVASCRIPT_ANALYZER_VERSION = "javascript-production-v1";
export const PRODUCTION_JAVASCRIPT_RULE_SET_VERSION = "javascript-rules-v1";

export const productionJavaScriptAnalyzer = {
  version: PRODUCTION_JAVASCRIPT_ANALYZER_VERSION,
  ruleSet: {
    version: PRODUCTION_JAVASCRIPT_RULE_SET_VERSION,
    factRules: [
      dependencyInventoryRule,
      frameworkToolDetectionRule,
      npmRegistryHealthFactRule,
      projectConfigurationRule,
      scoringCoverageFactRule,
      sourceUsageFactRule,
    ],
    findingRules: [
      dependencyOverlapRule,
      deprecatedDependencyRule,
      knownVulnerabilityRule,
      migrationOpportunityRule,
      outdatedDependencyRule,
      potentiallyUnnecessaryDependencyRule,
    ],
    prioritizer: javascriptFindingPrioritizer,
    recommendationRules: [evidenceBackedRecommendationRule],
  },
  scorer: stackHealthScorer,
} satisfies AnalyzerDefinition<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>;
