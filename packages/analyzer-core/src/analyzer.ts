import { IdentifierSchema } from "@stacklens/contracts";
import type {
  AnalysisInput,
  AnalysisLimitation,
  AnalysisReport,
  DataSource,
  Evidence,
  PartialFailure,
} from "@stacklens/contracts";

import type { AnalysisContext, DeepReadonly } from "./context.js";
import { AnalyzerConfigurationError } from "./errors.js";
import { runRulePipeline } from "./pipeline.js";
import { assembleAnalysisReport } from "./report.js";
import type { AnalysisRuleSet } from "./rules.js";
import type { AnalysisScorer, ScoringContext } from "./scoring.js";

export interface AnalyzerDefinition<TProjectSnapshot, TMetadataSnapshot> {
  readonly version: string;
  readonly ruleSet: AnalysisRuleSet<TProjectSnapshot, TMetadataSnapshot>;
  readonly scorer: AnalysisScorer;
}

export interface AnalyzerRunInput<TProjectSnapshot, TMetadataSnapshot> {
  readonly analysisId: string;
  readonly createdAt: string;
  readonly input: AnalysisInput;
  readonly project: DeepReadonly<TProjectSnapshot>;
  readonly metadata: DeepReadonly<TMetadataSnapshot>;
  readonly sources: readonly DataSource[];
  readonly evidence: readonly Evidence[];
  readonly limitations?: readonly AnalysisLimitation[];
  readonly partialFailures?: readonly PartialFailure[];
}

function assertAnalyzerDefinition<TProjectSnapshot, TMetadataSnapshot>(
  definition: AnalyzerDefinition<TProjectSnapshot, TMetadataSnapshot>,
) {
  if (!IdentifierSchema.safeParse(definition.version).success) {
    throw new AnalyzerConfigurationError("Analyzer version must be a valid identifier");
  }

  if (!IdentifierSchema.safeParse(definition.scorer.version).success) {
    throw new AnalyzerConfigurationError("Scorer version must be a valid identifier");
  }
}

export function runAnalyzer<TProjectSnapshot, TMetadataSnapshot>(
  definition: AnalyzerDefinition<TProjectSnapshot, TMetadataSnapshot>,
  runInput: AnalyzerRunInput<TProjectSnapshot, TMetadataSnapshot>,
): AnalysisReport {
  assertAnalyzerDefinition(definition);

  const context: AnalysisContext<TProjectSnapshot, TMetadataSnapshot> = {
    input: runInput.input,
    project: runInput.project,
    metadata: runInput.metadata,
    sources: [...runInput.sources],
    evidence: [...runInput.evidence],
    limitations: [...(runInput.limitations ?? [])],
    partialFailures: [...(runInput.partialFailures ?? [])],
  };

  const ruleResult = runRulePipeline(context, definition.ruleSet, runInput.createdAt);

  const scoringContext: ScoringContext = {
    sources: context.sources,
    evidence: context.evidence,
    facts: ruleResult.facts,
    findings: ruleResult.findings,
    limitations: ruleResult.limitations,
    partialFailures: ruleResult.partialFailures,
  };

  const scores = definition.scorer.score(scoringContext);

  return assembleAnalysisReport({
    analysisId: runInput.analysisId,
    createdAt: runInput.createdAt,
    input: runInput.input,
    analyzer: {
      version: definition.version,
      ruleSetVersion: definition.ruleSet.version,
      scoringVersion: definition.scorer.version,
    },
    sources: context.sources,
    evidence: context.evidence,
    ruleResult,
    scores,
  });
}
