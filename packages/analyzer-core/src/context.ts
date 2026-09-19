import type {
  AnalysisFact,
  AnalysisInput,
  AnalysisLimitation,
  DataSource,
  Evidence,
  Finding,
  PartialFailure,
} from "@stacklens/contracts";

export interface AnalysisContext<TProjectSnapshot, TMetadataSnapshot> {
  readonly input: AnalysisInput;
  readonly project: Readonly<TProjectSnapshot>;
  readonly metadata: Readonly<TMetadataSnapshot>;
  readonly sources: readonly DataSource[];
  readonly evidence: readonly Evidence[];
  readonly limitations: readonly AnalysisLimitation[];
  readonly partialFailures: readonly PartialFailure[];
}

export type FactRuleContext<TProjectSnapshot, TMetadataSnapshot> = AnalysisContext<
  TProjectSnapshot,
  TMetadataSnapshot
>;

export interface FindingRuleContext<TProjectSnapshot, TMetadataSnapshot> extends AnalysisContext<
  TProjectSnapshot,
  TMetadataSnapshot
> {
  readonly facts: readonly AnalysisFact[];
}

export interface RecommendationRuleContext<
  TProjectSnapshot,
  TMetadataSnapshot,
> extends FindingRuleContext<TProjectSnapshot, TMetadataSnapshot> {
  readonly findings: readonly Finding[];
}
