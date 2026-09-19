import {
  AnalysisFactSchema,
  AnalysisLimitationSchema,
  FindingSchema,
  RecommendationSchema,
} from "@stacklens/contracts";
import type {
  AnalysisFact,
  AnalysisLimitation,
  Finding,
  Recommendation,
  RequirementId,
} from "@stacklens/contracts";

import type { FactRuleContext, FindingRuleContext, RecommendationRuleContext } from "./context.js";
import { AnalyzerInvariantError } from "./errors.js";

export interface RuleDefinition {
  readonly id: string;
  readonly version: string;
  readonly requirementIds: readonly RequirementId[];
}

export interface FactRuleResult {
  readonly facts?: readonly AnalysisFact[];
  readonly limitations?: readonly AnalysisLimitation[];
}

export interface FindingRuleResult {
  readonly findings?: readonly Finding[];
  readonly limitations?: readonly AnalysisLimitation[];
}

export interface RecommendationRuleResult {
  readonly recommendations?: readonly Recommendation[];
  readonly limitations?: readonly AnalysisLimitation[];
}

export interface FactRule<TProjectSnapshot, TMetadataSnapshot> extends RuleDefinition {
  readonly kind: "fact";
  evaluate(context: FactRuleContext<TProjectSnapshot, TMetadataSnapshot>): FactRuleResult;
}

export interface FindingRule<TProjectSnapshot, TMetadataSnapshot> extends RuleDefinition {
  readonly kind: "finding";
  evaluate(context: FindingRuleContext<TProjectSnapshot, TMetadataSnapshot>): FindingRuleResult;
}

export interface RecommendationRule<TProjectSnapshot, TMetadataSnapshot> extends RuleDefinition {
  readonly kind: "recommendation";
  evaluate(
    context: RecommendationRuleContext<TProjectSnapshot, TMetadataSnapshot>,
  ): RecommendationRuleResult;
}

export interface AnalysisRuleSet<TProjectSnapshot, TMetadataSnapshot> {
  readonly version: string;
  readonly factRules: readonly FactRule<TProjectSnapshot, TMetadataSnapshot>[];
  readonly findingRules: readonly FindingRule<TProjectSnapshot, TMetadataSnapshot>[];
  readonly recommendationRules: readonly RecommendationRule<TProjectSnapshot, TMetadataSnapshot>[];
}

function assertOwnedRequirements(
  rule: RuleDefinition,
  requirementIds: readonly RequirementId[],
  entityLabel: string,
) {
  const declared = new Set(rule.requirementIds);

  for (const requirementId of requirementIds) {
    if (!declared.has(requirementId)) {
      throw new AnalyzerInvariantError(
        `Rule ${rule.id} emitted ${entityLabel} with undeclared requirement ${requirementId}`,
      );
    }
  }
}

function assertRuleReference(
  rule: RuleDefinition,
  value: { readonly rule: { readonly id: string; readonly version: string } },
  entityLabel: string,
) {
  if (value.rule.id !== rule.id || value.rule.version !== rule.version) {
    throw new AnalyzerInvariantError(
      `Rule ${rule.id}@${rule.version} emitted ${entityLabel} owned by ${value.rule.id}@${value.rule.version}`,
    );
  }
}

function parseContractEntity<T>(
  result: { readonly success: true; readonly data: T } | { readonly success: false },
  rule: RuleDefinition,
  entityLabel: string,
): T {
  if (!result.success) {
    throw new AnalyzerInvariantError(`Rule ${rule.id} emitted schema-invalid ${entityLabel}`);
  }

  return result.data;
}

function validateLimitations(
  rule: RuleDefinition,
  limitations: readonly AnalysisLimitation[] | undefined,
): readonly AnalysisLimitation[] {
  return (limitations ?? []).map((limitation) => {
    const parsed = parseContractEntity(
      AnalysisLimitationSchema.safeParse(limitation),
      rule,
      "limitation",
    );

    if (!parsed.ruleIds.includes(rule.id)) {
      throw new AnalyzerInvariantError(
        `Rule ${rule.id} emitted limitation ${parsed.id} without referencing itself in ruleIds`,
      );
    }

    return parsed;
  });
}

export function validateFactRuleResult(
  rule: RuleDefinition,
  result: FactRuleResult,
): Required<FactRuleResult> {
  const facts = (result.facts ?? []).map((fact) => {
    const parsed = parseContractEntity(AnalysisFactSchema.safeParse(fact), rule, "fact");
    assertRuleReference(rule, parsed, `fact ${parsed.id}`);
    assertOwnedRequirements(rule, parsed.requirementIds, `fact ${parsed.id}`);
    return parsed;
  });

  return {
    facts,
    limitations: validateLimitations(rule, result.limitations),
  };
}

export function validateFindingRuleResult(
  rule: RuleDefinition,
  result: FindingRuleResult,
): Required<FindingRuleResult> {
  const findings = (result.findings ?? []).map((finding) => {
    const parsed = parseContractEntity(FindingSchema.safeParse(finding), rule, "finding");
    assertRuleReference(rule, parsed, `finding ${parsed.id}`);
    assertOwnedRequirements(rule, parsed.requirementIds, `finding ${parsed.id}`);
    return parsed;
  });

  return {
    findings,
    limitations: validateLimitations(rule, result.limitations),
  };
}

export function validateRecommendationRuleResult(
  rule: RuleDefinition,
  result: RecommendationRuleResult,
): Required<RecommendationRuleResult> {
  const recommendations = (result.recommendations ?? []).map((recommendation) => {
    const parsed = parseContractEntity(
      RecommendationSchema.safeParse(recommendation),
      rule,
      "recommendation",
    );
    assertRuleReference(rule, parsed, `recommendation ${parsed.id}`);
    assertOwnedRequirements(rule, parsed.requirementIds, `recommendation ${parsed.id}`);
    return parsed;
  });

  return {
    recommendations,
    limitations: validateLimitations(rule, result.limitations),
  };
}
