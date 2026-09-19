import type {
  AnalysisFact,
  AnalysisInput,
  AnalysisLimitation,
  DataSource,
  Evidence,
  Finding,
  PartialFailure,
} from "@stacklens/contracts";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export interface AnalysisContext<TProjectSnapshot, TMetadataSnapshot> {
  readonly input: AnalysisInput;
  readonly project: DeepReadonly<TProjectSnapshot>;
  readonly metadata: DeepReadonly<TMetadataSnapshot>;
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
