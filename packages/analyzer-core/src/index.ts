export { runAnalyzer } from "./analyzer.js";
export type { AnalyzerDefinition, AnalyzerRunInput } from "./analyzer.js";

export type {
  AnalysisContext,
  FactRuleContext,
  FindingRuleContext,
  RecommendationRuleContext,
} from "./context.js";

export { AnalyzerConfigurationError, AnalyzerInvariantError } from "./errors.js";

export { runRulePipeline } from "./pipeline.js";
export type { RulePipelineResult } from "./pipeline.js";

export { assembleAnalysisReport } from "./report.js";
export type { AnalysisReportAssemblyInput } from "./report.js";

export {
  validateFactRuleResult,
  validateFindingRuleResult,
  validateRecommendationRuleResult,
} from "./rules.js";
export type {
  AnalysisRuleSet,
  FactRule,
  FactRuleResult,
  FindingRule,
  FindingRuleResult,
  RecommendationRule,
  RecommendationRuleResult,
  RuleDefinition,
} from "./rules.js";

export type { AnalysisScorer, ScoringContext } from "./scoring.js";
