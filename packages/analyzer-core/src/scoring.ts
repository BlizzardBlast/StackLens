import type {
  AnalysisFact,
  AnalysisLimitation,
  AnalysisScores,
  DataSource,
  Evidence,
  Finding,
  PartialFailure,
} from "@stacklens/contracts";

export interface ScoringContext {
  readonly sources: readonly DataSource[];
  readonly evidence: readonly Evidence[];
  readonly facts: readonly AnalysisFact[];
  readonly findings: readonly Finding[];
  readonly limitations: readonly AnalysisLimitation[];
  readonly partialFailures: readonly PartialFailure[];
}

export interface AnalysisScorer {
  readonly version: string;
  score(context: ScoringContext): AnalysisScores;
}
