import { IdentifierSchema, RequirementIdSchema } from "@stacklens/contracts";
import type {
  AnalysisFact,
  AnalysisLimitation,
  Finding,
  PartialFailure,
  Recommendation,
  RuleReference,
  ScoreCategory,
} from "@stacklens/contracts";

import type { AnalysisContext, FindingRuleContext, RecommendationRuleContext } from "./context.js";
import { AnalyzerConfigurationError, AnalyzerInvariantError } from "./errors.js";
import {
  applyFindingPriority,
  type FindingCandidate,
  type PrioritizationContext,
} from "./priority.js";
import type { RuleDefinition } from "./rule-definition.js";
import type { AnalysisRuleSet } from "./rules.js";
import {
  validateFactRuleResult,
  validateFindingRuleResult,
  validateRecommendationRuleResult,
} from "./rules.js";

export interface RulePipelineResult {
  readonly facts: readonly AnalysisFact[];
  readonly findings: readonly Finding[];
  readonly recommendations: readonly Recommendation[];
  readonly limitations: readonly AnalysisLimitation[];
  readonly partialFailures: readonly PartialFailure[];
}

type FailureCode =
  | "rule_evaluation_failed"
  | "rule_output_invalid"
  | "priority_evaluation_failed"
  | "priority_output_invalid";

interface RuleFailureArtifacts {
  readonly limitation: AnalysisLimitation;
  readonly partialFailure: PartialFailure;
}

function sortedRules<T extends RuleDefinition>(rules: readonly T[]): readonly T[] {
  return rules.toSorted((left, right) => left.id.localeCompare(right.id, "en"));
}

function assertDefinition(rule: RuleDefinition, seenIds: Set<string>) {
  if (!IdentifierSchema.safeParse(rule.id).success) {
    throw new AnalyzerConfigurationError("Rule IDs must be valid identifiers");
  }

  if (!IdentifierSchema.safeParse(rule.version).success) {
    throw new AnalyzerConfigurationError(`Rule ${rule.id} has an invalid version`);
  }

  if (rule.requirementIds.length === 0) {
    throw new AnalyzerConfigurationError(`Rule ${rule.id} must declare at least one requirement ID`);
  }

  for (const requirementId of rule.requirementIds) {
    if (!RequirementIdSchema.safeParse(requirementId).success) {
      throw new AnalyzerConfigurationError(
        `Rule ${rule.id} declares invalid requirement ID: ${requirementId}`,
      );
    }
  }

  if (seenIds.has(rule.id)) {
    throw new AnalyzerConfigurationError(`Duplicate rule ID: ${rule.id}`);
  }

  seenIds.add(rule.id);
}

function assertRuleSet<TProjectSnapshot, TMetadataSnapshot>(
  ruleSet: AnalysisRuleSet<TProjectSnapshot, TMetadataSnapshot>,
) {
  if (!IdentifierSchema.safeParse(ruleSet.version).success) {
    throw new AnalyzerConfigurationError("Rule-set version must be a valid identifier");
  }

  const seenIds = new Set<string>();
  const allRules: readonly RuleDefinition[] = [
    ...ruleSet.factRules,
    ...ruleSet.findingRules,
    ruleSet.prioritizer,
    ...ruleSet.recommendationRules,
  ];

  for (const rule of allRules) {
    assertDefinition(rule, seenIds);
  }

  if (ruleSet.prioritizer.kind !== "priority") {
    throw new AnalyzerConfigurationError("Rule-set prioritizer must have kind=priority");
  }
}

function allocateIdentifier(preferred: string, usedIds: Set<string>): string {
  const maxLength = 200;
  const initial = preferred.slice(0, maxLength);

  if (!usedIds.has(initial)) {
    usedIds.add(initial);
    return initial;
  }

  for (let counter = 2; ; counter += 1) {
    const suffix = `#${counter}`;
    const candidate = `${preferred.slice(0, maxLength - suffix.length)}${suffix}`;

    if (!usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
}

function createFailureArtifacts(
  rule: RuleDefinition,
  occurredAt: string,
  code: FailureCode,
  usedLimitationIds: Set<string>,
  usedPartialFailureIds: Set<string>,
  finding?: FindingCandidate,
): RuleFailureArtifacts {
  const ruleReference: RuleReference = {
    id: rule.id,
    version: rule.version,
  };
  const subjectSuffix = finding === undefined ? "" : `:${finding.id}`;
  const category: readonly ScoreCategory[] = finding === undefined ? [] : [finding.category];

  const limitationId = allocateIdentifier(
    `limitation:${code}:${rule.id}${subjectSuffix}`,
    usedLimitationIds,
  );
  const partialFailureId = allocateIdentifier(
    `partial-failure:${code}:${rule.id}${subjectSuffix}`,
    usedPartialFailureIds,
  );

  const outputInvalid = code === "rule_output_invalid" || code === "priority_output_invalid";
  const priorityFailure = code.startsWith("priority_");

  return {
    limitation: {
      id: limitationId,
      kind: "partial_failure",
      message:
        finding === undefined
          ? `Rule ${rule.id} could not complete. Its outputs were omitted.`
          : `Finding ${finding.id} could not be prioritized and was omitted.`,
      affectedCategories: [...category],
      sourceIds: [],
      ruleIds: [rule.id],
    },
    partialFailure: {
      id: partialFailureId,
      scope: "rule",
      rule: ruleReference,
      code,
      message: outputInvalid
        ? priorityFailure
          ? `Priority rule ${rule.id} emitted invalid priority output.`
          : `Rule ${rule.id} emitted invalid analyzer output.`
        : priorityFailure
          ? `Priority rule ${rule.id} could not complete deterministic evaluation.`
          : `Rule ${rule.id} could not complete deterministic evaluation.`,
      retryable: false,
      occurredAt,
    },
  };
}

function createStageContext<TProjectSnapshot, TMetadataSnapshot>(
  context: AnalysisContext<TProjectSnapshot, TMetadataSnapshot>,
  limitations: readonly AnalysisLimitation[],
  partialFailures: readonly PartialFailure[],
): AnalysisContext<TProjectSnapshot, TMetadataSnapshot> {
  return {
    ...context,
    sources: [...context.sources],
    evidence: [...context.evidence],
    limitations: [...limitations],
    partialFailures: [...partialFailures],
  };
}

function assertNoDuplicateIds(
  existingIds: Set<string>,
  values: readonly { readonly id: string }[],
  label: string,
) {
  const localIds = new Set<string>();

  for (const value of values) {
    if (existingIds.has(value.id) || localIds.has(value.id)) {
      throw new AnalyzerInvariantError(`Duplicate ${label} ID: ${value.id}`);
    }

    localIds.add(value.id);
  }
}

function assertEvidenceReferences(
  values: readonly { readonly evidenceIds: readonly string[] }[],
  evidenceIds: ReadonlySet<string>,
  label: string,
) {
  for (const value of values) {
    for (const evidenceId of value.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        throw new AnalyzerInvariantError(
          `${label} ${"id" in value ? String(value.id) : ""} references unknown evidence ${evidenceId}`,
        );
      }
    }
  }
}

function assertFindingReferences(
  findings: readonly FindingCandidate[],
  factIds: ReadonlySet<string>,
  evidenceIds: ReadonlySet<string>,
  limitationIds: ReadonlySet<string>,
) {
  assertEvidenceReferences(findings, evidenceIds, "Finding");

  for (const finding of findings) {
    for (const factId of finding.factIds) {
      if (!factIds.has(factId)) {
        throw new AnalyzerInvariantError(
          `Finding ${finding.id} references unknown fact ${factId}`,
        );
      }
    }

    for (const limitationId of finding.limitationIds) {
      if (!limitationIds.has(limitationId)) {
        throw new AnalyzerInvariantError(
          `Finding ${finding.id} references unknown limitation ${limitationId}`,
        );
      }
    }

    if (finding.classification === "heuristic") {
      for (const confidenceFactId of finding.confidence.factIds) {
        if (!finding.factIds.includes(confidenceFactId)) {
          throw new AnalyzerInvariantError(
            `Finding ${finding.id} confidence references fact not listed in finding.factIds: ${confidenceFactId}`,
          );
        }
      }
    }
  }
}

function assertRecommendationReferences(
  recommendations: readonly Recommendation[],
  findingIds: ReadonlySet<string>,
  factIds: ReadonlySet<string>,
  evidenceIds: ReadonlySet<string>,
) {
  assertEvidenceReferences(recommendations, evidenceIds, "Recommendation");

  for (const recommendation of recommendations) {
    for (const findingId of recommendation.findingIds) {
      if (!findingIds.has(findingId)) {
        throw new AnalyzerInvariantError(
          `Recommendation ${recommendation.id} references unknown finding ${findingId}`,
        );
      }
    }

    if (recommendation.basis === "heuristic") {
      for (const factId of recommendation.confidence.factIds) {
        if (!factIds.has(factId)) {
          throw new AnalyzerInvariantError(
            `Recommendation ${recommendation.id} confidence references unknown fact ${factId}`,
          );
        }
      }
    }
  }
}

export function runRulePipeline<TProjectSnapshot, TMetadataSnapshot>(
  context: AnalysisContext<TProjectSnapshot, TMetadataSnapshot>,
  ruleSet: AnalysisRuleSet<TProjectSnapshot, TMetadataSnapshot>,
  occurredAt: string,
): RulePipelineResult {
  assertRuleSet(ruleSet);

  const limitations: AnalysisLimitation[] = [...context.limitations];
  const partialFailures: PartialFailure[] = [...context.partialFailures];
  const facts: AnalysisFact[] = [];
  const findingCandidates: FindingCandidate[] = [];
  const findings: Finding[] = [];
  const recommendations: Recommendation[] = [];

  const evidenceIds = new Set(context.evidence.map((evidence) => evidence.id));
  const factIds = new Set<string>();
  const findingCandidateIds = new Set<string>();
  const findingIds = new Set<string>();
  const recommendationIds = new Set<string>();
  const limitationIds = new Set(limitations.map((limitation) => limitation.id));
  const partialFailureIds = new Set(partialFailures.map((failure) => failure.id));

  const factStageContext = createStageContext(context, limitations, partialFailures);

  for (const rule of sortedRules(ruleSet.factRules)) {
    try {
      const result = validateFactRuleResult(rule, rule.evaluate(factStageContext));
      assertNoDuplicateIds(factIds, result.facts, "fact");
      assertEvidenceReferences(result.facts, evidenceIds, "Fact");
      assertNoDuplicateIds(limitationIds, result.limitations, "limitation");

      facts.push(...result.facts);
      result.facts.forEach((fact) => factIds.add(fact.id));
      limitations.push(...result.limitations);
      result.limitations.forEach((limitation) => limitationIds.add(limitation.id));
    } catch (error) {
      const failure = createFailureArtifacts(
        rule,
        occurredAt,
        error instanceof AnalyzerInvariantError ? "rule_output_invalid" : "rule_evaluation_failed",
        limitationIds,
        partialFailureIds,
      );
      limitations.push(failure.limitation);
      partialFailures.push(failure.partialFailure);
    }
  }

  const findingStageContext: FindingRuleContext<TProjectSnapshot, TMetadataSnapshot> = {
    ...createStageContext(context, limitations, partialFailures),
    facts: [...facts],
  };

  for (const rule of sortedRules(ruleSet.findingRules)) {
    try {
      const result = validateFindingRuleResult(rule, rule.evaluate(findingStageContext));
      assertNoDuplicateIds(findingCandidateIds, result.findings, "finding");
      assertNoDuplicateIds(limitationIds, result.limitations, "limitation");
      assertFindingReferences(result.findings, factIds, evidenceIds, limitationIds);

      findingCandidates.push(...result.findings);
      result.findings.forEach((finding) => findingCandidateIds.add(finding.id));
      limitations.push(...result.limitations);
      result.limitations.forEach((limitation) => limitationIds.add(limitation.id));
    } catch (error) {
      const failure = createFailureArtifacts(
        rule,
        occurredAt,
        error instanceof AnalyzerInvariantError ? "rule_output_invalid" : "rule_evaluation_failed",
        limitationIds,
        partialFailureIds,
      );
      limitations.push(failure.limitation);
      partialFailures.push(failure.partialFailure);
    }
  }

  const priorityContext: PrioritizationContext<TProjectSnapshot, TMetadataSnapshot> = {
    ...createStageContext(context, limitations, partialFailures),
    facts: [...facts],
    findings: [...findingCandidates],
  };

  for (const candidate of findingCandidates) {
    try {
      const finding = applyFindingPriority(ruleSet.prioritizer, priorityContext, candidate);
      assertNoDuplicateIds(findingIds, [finding], "finding");

      findings.push(finding);
      findingIds.add(finding.id);
    } catch (error) {
      const failure = createFailureArtifacts(
        ruleSet.prioritizer,
        occurredAt,
        error instanceof AnalyzerInvariantError
          ? "priority_output_invalid"
          : "priority_evaluation_failed",
        limitationIds,
        partialFailureIds,
        candidate,
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
    findings: [...findings],
  };

  for (const rule of sortedRules(ruleSet.recommendationRules)) {
    try {
      const result = validateRecommendationRuleResult(
        rule,
        rule.evaluate(recommendationStageContext),
      );
      assertNoDuplicateIds(recommendationIds, result.recommendations, "recommendation");
      assertNoDuplicateIds(limitationIds, result.limitations, "limitation");
      assertRecommendationReferences(result.recommendations, findingIds, factIds, evidenceIds);

      recommendations.push(...result.recommendations);
      result.recommendations.forEach((recommendation) =>
        recommendationIds.add(recommendation.id),
      );
      limitations.push(...result.limitations);
      result.limitations.forEach((limitation) => limitationIds.add(limitation.id));
    } catch (error) {
      const failure = createFailureArtifacts(
        rule,
        occurredAt,
        error instanceof AnalyzerInvariantError ? "rule_output_invalid" : "rule_evaluation_failed",
        limitationIds,
        partialFailureIds,
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
    partialFailures,
  };
}
