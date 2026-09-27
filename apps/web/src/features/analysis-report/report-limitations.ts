import type { AnalysisLimitation } from "@stacklens/contracts";

export interface LimitationGroup {
  readonly anchor: string;
  readonly kind: AnalysisLimitation["kind"];
  readonly message: string;
  readonly limitations: readonly AnalysisLimitation[];
}

export function groupLimitations(limitations: readonly AnalysisLimitation[]): LimitationGroup[] {
  const groups = new Map<string, AnalysisLimitation[]>();
  for (const limitation of limitations) {
    const key = JSON.stringify([limitation.kind, limitation.message]);
    const group = groups.get(key) ?? [];
    group.push(limitation);
    groups.set(key, group);
  }
  return [...groups.values()].map((group, index) => ({
    anchor: `limitation-group-${index}`,
    kind: group[0]!.kind,
    message: group[0]!.message,
    limitations: group,
  }));
}
