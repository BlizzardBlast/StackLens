import type { FindingCandidate, FindingRule } from "@stacklens/analyzer-core";
import type { AnalysisFact } from "@stacklens/contracts";

import type { NormalizedPackageManifest } from "./manifest.js";
import { compareCodeUnits, truncate, uniqueSorted } from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-OVERLAP-008";
const RULE_VERSION = "1";

interface OverlapDescriptor {
  readonly packages: readonly [string, string];
  readonly capability: string;
  readonly rationale: string;
}

const OVERLAP_DESCRIPTORS: readonly OverlapDescriptor[] = [
  {
    packages: ["@biomejs/biome", "eslint"],
    capability: "linting",
    rationale:
      "Both packages can provide JavaScript/TypeScript linting, so parallel configuration can duplicate rule ownership and maintenance work.",
  },
  {
    packages: ["@biomejs/biome", "prettier"],
    capability: "code formatting",
    rationale:
      "Both packages can format JavaScript/TypeScript code, so overlapping formatter ownership can create conflicting output or duplicated configuration.",
  },
  {
    packages: ["axios", "ky"],
    capability: "HTTP client",
    rationale:
      "Both packages provide application-level HTTP client abstractions, so using both can increase API surface and duplicate request conventions.",
  },
  {
    packages: ["dayjs", "moment"],
    capability: "date/time utilities",
    rationale:
      "Both packages provide broad date/time manipulation utilities, so parallel use can duplicate conventions and increase maintenance surface.",
  },
  {
    packages: ["jest", "vitest"],
    capability: "test runner",
    rationale:
      "Both packages provide JavaScript/TypeScript test-runner responsibilities, so parallel suites can duplicate setup, configuration, and developer workflows.",
  },
];

function factsByPackage(facts: readonly AnalysisFact[]): ReadonlyMap<string, readonly AnalysisFact[]> {
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

export function dependencyOverlapFindingId(
  firstPackage: string,
  secondPackage: string,
  capability: string,
): string {
  const packages = [firstPackage, secondPackage].toSorted(compareCodeUnits);
  return `finding-js-overlap-${stableHash(JSON.stringify([packages, capability]))}`;
}

function createFinding(
  descriptor: OverlapDescriptor,
  firstFacts: readonly AnalysisFact[],
  secondFacts: readonly AnalysisFact[],
): FindingCandidate {
  const packageNames = [...descriptor.packages].toSorted(compareCodeUnits);
  const facts = [...firstFacts, ...secondFacts].toSorted((left, right) =>
    compareCodeUnits(left.id, right.id),
  );
  const factIds = facts.map((fact) => fact.id);
  const evidenceIds = uniqueSorted(facts.flatMap((fact) => fact.evidenceIds));

  return {
    id: dependencyOverlapFindingId(packageNames[0]!, packageNames[1]!, descriptor.capability),
    category: "dependencies",
    classification: "heuristic",
    subject: {
      type: "dependency_overlap",
      name: `${packageNames[0]} + ${packageNames[1]}`,
      path: "package.json",
    },
    title: truncate(
      `Potential ${descriptor.capability} overlap: ${packageNames[0]} and ${packageNames[1]}`,
      500,
    ),
    description: truncate(
      `Both ${packageNames[0]} and ${packageNames[1]} are declared, and StackLens has an explicit supported overlap rule for their ${descriptor.capability} responsibilities. ${descriptor.rationale} This finding does not establish that either dependency is unnecessary; actual project usage and migration context still need to be considered.`,
      4_000,
    ),
    rule: {
      id: RULE_ID,
      version: RULE_VERSION,
    },
    requirementIds: ["FR-008", "DATA-003", "DATA-004"],
    evidenceIds: [...evidenceIds],
    factIds,
    limitationIds: [],
    confidence: {
      level: "medium",
      rationale:
        "The overlap capability is an explicit curated rule and both packages are declared, but manifest declarations alone do not establish duplicated runtime usage or that either package can be removed.",
      factIds,
    },
  };
}

export const dependencyOverlapRule: FindingRule<NormalizedPackageManifest, unknown> = {
  kind: "finding",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-008",
    "FR-017",
    "DATA-003",
    "DATA-004",
    "DATA-005",
    "NFR-001",
    "NFR-002",
    "NFR-004",
    "NFR-005",
  ],
  evaluate(context) {
    const byPackage = factsByPackage(context.facts);
    const findings = OVERLAP_DESCRIPTORS.flatMap((descriptor) => {
      const firstFacts = byPackage.get(descriptor.packages[0]);
      const secondFacts = byPackage.get(descriptor.packages[1]);

      return firstFacts === undefined || secondFacts === undefined
        ? []
        : [createFinding(descriptor, firstFacts, secondFacts)];
    });

    return {
      findings,
    };
  },
};
