import { FindingPrioritySchema } from "@stacklens/contracts";
import type {
  FactualFinding,
  Finding,
  FindingPriority,
  HeuristicFinding,
  RequirementId,
} from "@stacklens/contracts";

import type { AnalysisContext } from "./context.js";
import { AnalyzerInvariantError } from "./errors.js";
import type { RuleDefinition } from "./rules.js";

export type FactualFindingCandidate = Omit<FactualFinding, "priority">;
export type HeuristicFindingCandidate = Omit<HeuristicFinding, "priority">;
export type FindingCandidate = FactualFindingCandidate | HeuristicFindingCandidate;

export interface PrioritizationContext<TProjectSnapshot, TMetadataSnapshot>
  extends AnalysisContext<TProjectSnapshot, TMetadataSnapshot> {
  readonly facts: readonly import("@stacklens/contracts").AnalysisFact[];
}

export interface FindingPrioritizer<TProjectSnapshot, TMetadataSnapshot> extends RuleDefinition {
  readonly kind: "priority";
  prioritize(
    context: PrioritizationContext<TProjectSnapshot, TMetadataSnapshot>,
    finding: FindingCandidate,
  ): FindingPriority;
}

export function applyFindingPriority<TProjectSnapshot, TMetadataSnapshot>(
  prioritizer: FindingPrioritizer<TProjectSnapshot, TMetadataSnapshot>,
  context: PrioritizationContext<TProjectSnapshot, TMetadataSnapshot>,
  candidate: FindingCandidate,
): Finding {
  const parsedPriority = FindingPrioritySchema.safeParse(prioritizer.prioritize(context, candidate));

  if (!parsedPriority.success) {
    throw new AnalyzerInvariantError(
      `Priority rule ${prioritizer.id} emitted schema-invalid priority for finding ${candidate.id}`,
    );
  }

  if (
    parsedPriority.data.rule.id !== prioritizer.id ||
    parsedPriority.data.rule.version !== prioritizer.version
  ) {
    throw new AnalyzerInvariantError(
      `Priority rule ${prioritizer.id}@${prioritizer.version} emitted priority owned by ${parsedPriority.data.rule.id}@${parsedPriority.data.rule.version}`,
    );
  }

  return {
    ...candidate,
    priority: parsedPriority.data,
  } as Finding;
}

export type { RequirementId };
