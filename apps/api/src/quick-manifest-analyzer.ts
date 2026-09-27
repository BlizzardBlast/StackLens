import { quickManifestJavaScriptAnalyzer } from "@stacklens/analysis-orchestration";

export const quickManifestAnalyzer = quickManifestJavaScriptAnalyzer;
export const QUICK_MANIFEST_ANALYZER_VERSION = quickManifestAnalyzer.version;
export const QUICK_MANIFEST_RULE_SET_VERSION = quickManifestAnalyzer.ruleSet.version;
export const QUICK_MANIFEST_SCORING_VERSION = quickManifestAnalyzer.scorer.version;
