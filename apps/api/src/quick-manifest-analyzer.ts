import type { AnalysisScorer, AnalyzerDefinition } from "@stacklens/analyzer-core";
import type { AnalysisScores } from "@stacklens/contracts";
import {
  dependencyInventoryRule,
  dependencyOverlapRule,
  evidenceBackedRecommendationRule,
  frameworkToolDetectionRule,
  javascriptFindingPrioritizer,
  type NormalizedPackageManifest,
} from "@stacklens/rules-javascript";

export const QUICK_MANIFEST_ANALYZER_VERSION = "javascript-quick-manifest-v2";
export const QUICK_MANIFEST_RULE_SET_VERSION = "javascript-quick-manifest-rules-v2";
export const QUICK_MANIFEST_SCORING_VERSION = "quick-manifest-insufficient-evidence-v1";

function createInsufficientEvidenceScores(limitationIds: readonly string[]): AnalysisScores {
  const score = {
    status: "insufficient_evidence" as const,
    evidenceCoverage: 0,
    limitationIds: [...limitationIds],
  };

  return {
    overall: score,
    categories: {
      dependencies: score,
      security: score,
      maintainability: score,
      testing: score,
      tooling: score,
    },
    contributions: [],
  };
}

const quickManifestScorer: AnalysisScorer = {
  version: QUICK_MANIFEST_SCORING_VERSION,
  score(context) {
    return createInsufficientEvidenceScores(context.limitations.map((limitation) => limitation.id));
  },
};

export const quickManifestAnalyzer = {
  version: QUICK_MANIFEST_ANALYZER_VERSION,
  ruleSet: {
    version: QUICK_MANIFEST_RULE_SET_VERSION,
    factRules: [dependencyInventoryRule, frameworkToolDetectionRule],
    findingRules: [dependencyOverlapRule],
    prioritizer: javascriptFindingPrioritizer,
    recommendationRules: [evidenceBackedRecommendationRule],
  },
  scorer: quickManifestScorer,
} satisfies AnalyzerDefinition<NormalizedPackageManifest, unknown>;
