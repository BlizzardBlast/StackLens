import type { RequirementId } from "@stacklens/contracts";

export interface RuleDefinition {
  readonly id: string;
  readonly version: string;
  readonly requirementIds: readonly RequirementId[];
}
