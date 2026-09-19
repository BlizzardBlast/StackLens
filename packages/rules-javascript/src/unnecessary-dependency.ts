import type { FindingCandidate, FindingRule } from "@stacklens/analyzer-core";
import type { AnalysisFact } from "@stacklens/contracts";

import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import { sourceUsageCoverageEvidenceId } from "./source-usage.js";
import { compareCodeUnits, truncate, uniqueSorted } from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-UNNECESSARY-009";
const RULE_VERSION = "1";

function inventoryFactsByPackage(
  facts: readonly AnalysisFact[],
): ReadonlyMap<string, readonly AnalysisFact[]> {
  const grouped = new Map<string, AnalysisFact[]>();

  for (const fact of facts) {
    if (
      fact.type !== "dependency.inventory" ||
      fact.subject.type !== "dependency" ||
      fact.details?.kind !== "dependency_inventory"
    ) {
      continue;
    }

    const existing = grouped.get(fact.subject.name) ?? [];
    existing.push(fact);
    grouped.set(fact.subject.name, existing);
  }

  return new Map(
    [...grouped.entries()].map(([packageName, packageFacts]) => [
      packageName,
      packageFacts.toSorted((left, right) => compareCodeUnits(left.id, right.id)),
    ]),
  );
}

function sourceUsagePackages(facts: readonly AnalysisFact[]): ReadonlySet<string> {
  return new Set(
    facts
      .filter(
        (fact) => fact.type === "dependency.usage.static" && fact.subject.type === "dependency",
      )
      .map((fact) => fact.subject.name),
  );
}

export function potentiallyUnnecessaryDependencyFindingId(packageName: string): string {
  return "finding-js-unnecessary-" + stableHash(packageName);
}

function createFinding(
  packageName: string,
  inventoryFacts: readonly AnalysisFact[],
  project: JavaScriptProjectSnapshot,
): FindingCandidate {
  const dependencyGroups = uniqueSorted(
    inventoryFacts.flatMap((fact) =>
      fact.details?.kind === "dependency_inventory" ? [fact.details.dependencyGroup] : [],
    ),
  );
  const lowConfidence =
    dependencyGroups.includes("devDependencies") || dependencyGroups.includes("peerDependencies");
  const factIds = inventoryFacts.map((fact) => fact.id);
  const evidenceIds = uniqueSorted([
    ...inventoryFacts.flatMap((fact) => fact.evidenceIds),
    sourceUsageCoverageEvidenceId(project.sourceUsage!),
  ]);

  return {
    id: potentiallyUnnecessaryDependencyFindingId(packageName),
    category: "dependencies",
    classification: "heuristic",
    subject: {
      type: "dependency",
      name: packageName,
      path: "package.json",
    },
    title: truncate("Potentially unnecessary dependency: " + packageName, 500),
    description: truncate(
      "StackLens found no supported static source, configuration, or package-script reference for " +
        packageName +
        " after complete analysis of the acquired supported JS/TS/JSX/TSX scope. This is a heuristic signal, not proof that the dependency can be removed: runtime loading, external tooling, generated code, or conventions outside the supported catalog can still require it.",
      4_000,
    ),
    rule: {
      id: RULE_ID,
      version: RULE_VERSION,
    },
    requirementIds: ["FR-009", "DATA-004"],
    evidenceIds: [...evidenceIds],
    factIds,
    limitationIds: [],
    confidence: {
      level: lowConfidence ? "low" : "medium",
      rationale: lowConfidence
        ? "Supported static analysis found no usage, but development/peer dependencies are commonly consumed through tooling and conventions that static source analysis may not observe."
        : "Supported source acquisition and parsing were complete and no supported source/configuration/script reference was found, but static analysis still cannot prove runtime non-use.",
      factIds,
    },
  };
}

export const potentiallyUnnecessaryDependencyRule: FindingRule<
  JavaScriptProjectSnapshot,
  unknown
> = {
  kind: "finding",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-009",
    "FR-017",
    "DATA-003",
    "DATA-004",
    "DATA-005",
    "NFR-001",
    "NFR-002",
    "NFR-004",
    "NFR-005",
    "SEC-001",
    "SEC-002",
  ],
  evaluate(context) {
    if (context.project.sourceUsage?.coverage !== "complete") {
      return {};
    }

    const inventory = inventoryFactsByPackage(context.facts);
    const usedPackages = sourceUsagePackages(context.facts);
    const findings = [...inventory.entries()]
      .filter(([packageName, facts]) => {
        if (usedPackages.has(packageName)) {
          return false;
        }

        return !facts.every(
          (fact) =>
            fact.details?.kind === "dependency_inventory" &&
            fact.details.dependencyGroup === "peerDependencies",
        );
      })
      .toSorted(([left], [right]) => compareCodeUnits(left, right))
      .map(([packageName, facts]) => createFinding(packageName, facts, context.project));

    return { findings };
  },
};
