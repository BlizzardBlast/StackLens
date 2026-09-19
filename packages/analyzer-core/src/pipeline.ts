import { IdentifierSchema, RequirementIdSchema } from "@stacklens/contracts";
import type {
  AnalysisFact,
  AnalysisLimitation,
  Finding,
  PartialFailure,
  Recommendation,
  RuleReference
} from "@stacklens/contracts";

import type {
  AnalysisContext,
  FindingRuleContext,
  RecommendationRuleContext
} from "./context.js";
import { AnalyzerConfigurationError, AnalyzerInvariantError } from "./errors.js";
import type {
  AnalysisRuleSet,
  FactRule,
  FindingRule,
  RecommendationRule,
  RuleDefinition
} from "./rules.js";
import {
  validateFactRuleResult,
  validateFindingRuleResult,
  validateRecommendationRuleResult
} from "./rules.js";

export interface RulePipelineResult {
  readonly facts: readonly AnalysisFact[];
  readonly findings: readonly Finding[];
  readonly recommendations: readonly Recommendation[];
  readonly limitations: readonly AnalysisLimitation[];
  readonly partialFailures: readonly PartialFailure[];
}

interface RuleFailureArtifacts {
  readonly limitation: AnalysisLimitation;
  readonly partialFailure: PartialFailure;
}

function sortedRules<T extends RuleDefinition>(rules: readonly T[]): readonly T[] {
  return [...rules].sort((left, right) => {
    if (left.id < right.id) {
      return -1;
    }

    if (left.id > right.id) {
      return 1;
    }

    return 0;
  });
}

function assertRuleSet<TProjectSnapshot, TMetadataSnapshot>(
  ruleSet: AnalysisRuleSet<TProjectSnapshot, TMetadataSnapshot>
) {
  if (!IdentifierSchema.safeParse(ruleSet.version).success) {
    throw new AnalyzerConfigurationError("Rule-set version must be a valid identifier");
  }

  const allRules = [
    ...ruleSet.factRules,
    ...ruleSet.findingRules,
    ...ruleSet.recommendationRules
  ];
  const seenIds = new Set<string>();

  for (const rule of allRules) {
    if (!IdentifierSchema.safeParse(rule.id).success) {
      throw new AnalyzerConfigurationError("Rule IDs must be valid identifiers");
    }

    if (!IdentifierSchema.safeParse(rule.version).success) {
      throw new AnalyzerConfigurationError(`Rule ${rule.id} has an invalid version`);
    }

    if (rule.requirementIds.length === 0) {
      throw new AnalyzerConfigurationError(
        `Rule ${rule.id} must declare at least one requirement ID`
      );
    }

    for (const requirementId of rule.requirementIds) {
      if (!RequirementIdSchema.safeParse(requirementId).success) {
        throw new AnalyzerConfigurationError(
          `Rule ${rule.id} declares invalid requirement ID: ${requirementId}`
        );
      }
    }

    if (seenIds.has(rule.id)) {
      throw new AnalyzerConfigurationError(`Duplicate rule ID: ${rule.id}`);
    }

    seenIds.add(rule.id);
  }
}

function createRuleFailureArtifacts(
  rule: RuleDefinition,
  occurredAt: string,
  code: "rule_evaluation_failed" | "rule_output_invalid"
): RuleFailureArtifacts {
  const ruleReference: RuleReference = {
    id: rule.id,
    version: rule.version
  };

  return {
    limitation: {
      id: rule.id,
      kind: "partial_failure",
      message: `Rule ${rule.id} could not complete. Its outputs were omitted.`,
      affectedCategories: [],
      sourceIds: [],
      ruleIds: [rule.id]
    },
    partialFailure: {
      id: rule.id,
      scope: "rule",
      rule: ruleReference,
      code,
      message:
        code === "rule_output_invalid"
          ? `Rule ${rule.id} emitted invalid analyzer output.`
          : `Rule ${rule.id} could not complete deterministic evaluation.`,
      retryable: false,
      occurredAt
    }
  };
}

function createStageContext<TProjectSnapshot, TMetadataSnapshot>(
  context: AnalysisContext<TProjectSnapshot, TMetadataSnapshot>,
  limitations: readonly AnalysisLimitation[],
  partialFailures: readonly PartialFailure[]
): AnalysisContext<TProjectSnapshot, TMetadataSnapshot> {
  return {
    ...context,
    sources: [...context.sources],
    evidence: [...context.evidence],
    limitations: [...limitations],
    partialFailures: [...partialFailures]
  };
}

export function runRulePipeline<TProjectSnapshot, TMetadataSnapshot>(
  context: AnalysisContext<TProjectSnapshot, TMetadataSnapshot>,
  ruleSet: AnalysisRuleSet<TProjectSnapshot, TMetadataSnapshot>,
  occurredAt: string
): RulePipelineResult {
  assertRuleSet(ruleSet);

  const limitations: AnalysisLimitation[] = [...context.limitations];
  const partialFailures: PartialFailure[] = [...context.partialFailures];
  const facts: AnalysisFact[] = [];
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  const factStageContext = createStageContext(context, limitations, partialFailures);

  for (const rule of sortedRules(ruleSet.factRules)) {
    try {
      const result = validateFactRuleResult(rule, rule.evaluate(factStageContext));
      facts.push(...result.facts);
      limitations.push(...result.limitations);
    } catch (error) {
      const failure = createRuleFailureArtifacts(
        rule,
        occurredAt,
        error instanceof AnalyzerInvariantError
          ? "rule_output_invalid"
          : "rule_evaluation_failed"
      );
      limitations.push(failure.limitation);
      partialFailures.push(failure.partialFailure);
    }
  }

  const findingStageContext: FindingRuleContext<TProjectSnapshot, TMetadataSnapshot> = {
    ...createStageContext(context, limitations, partialFailures),
    facts: [...facts]
  };

  for (const rule of sortedRules(ruleSet.findingRules)) {
    try {
      const result = validateFindingRuleResult(rule, rule.evaluate(findingStageContext));
      findings.push(...result.findings);
      limitations.push(...result.limitations);
    } catch (error) {
      const failure = createRuleFailureArtifacts(
        rule,
        occurredAt,
        error instanceof AnalyzerInvariantError
          ? "rule_output_invalid"
          : "rule_evaluation_failed"
      );
      limitations.push(failure.limitation);
      partialFailures.push(failure.partialFailure);
    }
  }

  const recommendationStageContext: RecommendationRuleContext<
    TProjectSnapshot,
    TMetadataSnapshot
  > = {
    ...createStageContext(context, limitations, partialFailures),
    facts: [...facts],
    findings: [...findings]
  };

  for (const rule of sortedRules(ruleSet.recommendationRules)) {
    try {
      const result = validateRecommendationRuleResult(
        rule,
        rule.evaluate(recommendationStageContext)
      );
      recommendations.push(...result.recommendations);
      limitations.push(...result.limitations);
    } catch (error) {
      const failure = createRuleFailureArtifacts(
        rule,
        occurredAt,
        error instanceof AnalyzerInvariantError
          ? "rule_output_invalid"
          : "rule_evaluation_failed"
      );
      limitations.push(failure.limitation);
      partialFailures.push(failure.partialFailure);
    }
  }

  return {
    facts,
    findings,
    recommendations,
    limitations,
    partialFailures
  };
}
