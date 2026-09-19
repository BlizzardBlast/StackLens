import type { AnalysisFact, AnalysisLimitation } from "@stacklens/contracts";

import type { NormalizedDependencyDeclaration, NormalizedPackageManifest } from "./manifest.js";
import { stableHash } from "./stable-id.js";

export interface DependencyFactBasis {
  readonly packageName: string;
  readonly declaredSpecifier: string;
  readonly facts: readonly AnalysisFact[];
}

export interface DependencyDeclarationBasis {
  readonly packageName: string;
  readonly declarations: readonly NormalizedDependencyDeclaration[];
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].toSorted(compareCodeUnits);
}

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

export function dependencyKey(packageName: string, declaredSpecifier: string): string {
  return JSON.stringify([packageName, declaredSpecifier]);
}

export function ruleLimitationId(ruleId: string, code: string, identity: string): string {
  return `limitation-${ruleId.toLowerCase()}-${stableHash(JSON.stringify([code, identity]))}`;
}

export function createRuleLimitation(
  ruleId: string,
  kind: AnalysisLimitation["kind"],
  code: string,
  identity: string,
  message: string,
  sourceIds: readonly string[],
): AnalysisLimitation {
  return {
    id: ruleLimitationId(ruleId, code, identity),
    kind,
    message: truncate(message, 4_000),
    affectedCategories: ["dependencies"],
    sourceIds: [...sourceIds],
    ruleIds: [ruleId],
  };
}

export function dependencyFactBases(facts: readonly AnalysisFact[]): readonly DependencyFactBasis[] {
  const grouped = new Map<
    string,
    {
      readonly packageName: string;
      readonly declaredSpecifier: string;
      readonly facts: AnalysisFact[];
    }
  >();

  for (const fact of facts) {
    if (
      fact.type !== "dependency.inventory" ||
      fact.subject.type !== "dependency" ||
      fact.details?.kind !== "dependency_inventory"
    ) {
      continue;
    }

    const packageName = fact.subject.name;
    const declaredSpecifier = fact.details.declaredSpecifier;
    const key = dependencyKey(packageName, declaredSpecifier);
    const existing = grouped.get(key);

    if (existing === undefined) {
      grouped.set(key, {
        packageName,
        declaredSpecifier,
        facts: [fact],
      });
      continue;
    }

    existing.facts.push(fact);
  }

  return [...grouped.values()]
    .map((basis) => ({
      packageName: basis.packageName,
      declaredSpecifier: basis.declaredSpecifier,
      facts: basis.facts.toSorted((left, right) => compareCodeUnits(left.id, right.id)),
    }))
    .toSorted((left, right) => {
      const packageOrder = compareCodeUnits(left.packageName, right.packageName);

      return packageOrder === 0
        ? compareCodeUnits(left.declaredSpecifier, right.declaredSpecifier)
        : packageOrder;
    });
}

export function dependencyDeclarationBases(
  project: NormalizedPackageManifest,
): readonly DependencyDeclarationBasis[] {
  const grouped = new Map<string, NormalizedDependencyDeclaration[]>();

  for (const declaration of project.dependencies) {
    const existing = grouped.get(declaration.name) ?? [];
    existing.push(declaration);
    grouped.set(declaration.name, existing);
  }

  return [...grouped.entries()]
    .map(([packageName, declarations]) => ({
      packageName,
      declarations: declarations.toSorted((left, right) => {
        const groupOrder = compareCodeUnits(left.group, right.group);

        return groupOrder === 0
          ? compareCodeUnits(left.declaredSpecifier, right.declaredSpecifier)
          : groupOrder;
      }),
    }))
    .toSorted((left, right) => compareCodeUnits(left.packageName, right.packageName));
}
