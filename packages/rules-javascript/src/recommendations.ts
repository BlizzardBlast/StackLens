import type { RecommendationRule } from "@stacklens/analyzer-core";
import type { Finding, Recommendation } from "@stacklens/contracts";

import { compareCodeUnits, truncate } from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-RECOMMEND-015";
const RULE_VERSION = "1";

interface RecommendationDescriptor {
  readonly suggestion: (finding: Finding) => string;
  readonly impact: string;
}

const DESCRIPTORS: Readonly<Record<string, RecommendationDescriptor>> = {
  "JS-VULN-011": {
    suggestion: (finding) =>
      `Review the advisory evidence for ${finding.subject.name} and choose a supported remediation, then verify the dependency change with the project's normal test/release process.`,
    impact:
      "Addressing a known vulnerable dependency can reduce exposure to the advisory while preserving a deliberate compatibility review.",
  },
  "JS-NPM-007": {
    suggestion: (finding) =>
      `Plan an update or replacement for the deprecated ${finding.subject.name} dependency version and verify the chosen path before rollout.`,
    impact:
      "Reducing reliance on explicitly deprecated versions can lower future maintenance and compatibility risk.",
  },
  "JS-NPM-006": {
    suggestion: (finding) =>
      `Evaluate updating ${finding.subject.name} toward the supported npm latest version identified by the finding, with compatibility and regression testing appropriate to the version difference.`,
    impact:
      "A deliberate update review can reduce dependency drift without treating every newer release as an automatic upgrade.",
  },
  "JS-MIGRATION-014": {
    suggestion: (finding) =>
      `Plan and test the major-version migration described for ${finding.subject.name}; review release notes and compatibility changes before deciding whether to adopt the target version.`,
    impact:
      "Treating a major-version change as a migration project makes compatibility work explicit and reduces surprise breakage.",
  },
  "JS-OVERLAP-008": {
    suggestion: (finding) =>
      `Review the overlapping responsibility described by ${finding.subject.name} and decide whether one implementation/configuration path can be consolidated after verifying actual usage.`,
    impact:
      "Consolidating genuinely duplicated responsibility can reduce configuration, dependency, and developer-workflow maintenance.",
  },
  "JS-UNNECESSARY-009": {
    suggestion: (finding) =>
      `Validate runtime, tooling, generated-code, and deployment usage for ${finding.subject.name}; consider removal only if that verification confirms the dependency is not required.`,
    impact:
      "Removing a genuinely unused dependency can reduce maintenance surface, while the verification step avoids treating static non-observation as proof.",
  },
};

export function recommendationId(findingId: string): string {
  return `recommendation-js-${stableHash(findingId)}`;
}

function recommendationFor(finding: Finding): Recommendation | undefined {
  const descriptor = DESCRIPTORS[finding.rule.id];

  if (descriptor === undefined) {
    return undefined;
  }

  const base = {
    id: recommendationId(finding.id),
    title: truncate(`Recommended action: ${finding.title}`, 500),
    suggestion: truncate(descriptor.suggestion(finding), 4_000),
    why: truncate(
      `${finding.description} StackLens prioritized this finding as ${finding.priority.level}: ${finding.priority.rationale}`,
      4_000,
    ),
    impact: truncate(descriptor.impact, 4_000),
    rule: {
      id: RULE_ID,
      version: RULE_VERSION,
    },
    requirementIds: ["FR-015", "FR-017", "DATA-005"],
    findingIds: [finding.id],
    evidenceIds: [...finding.evidenceIds],
  };

  return finding.classification === "fact"
    ? {
        ...base,
        basis: "fact",
      }
    : {
        ...base,
        basis: "heuristic",
        confidence: {
          level: finding.confidence.level,
          rationale: finding.confidence.rationale,
          factIds: [...finding.confidence.factIds],
        },
      };
}

export const evidenceBackedRecommendationRule: RecommendationRule<unknown, unknown> = {
  kind: "recommendation",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-015",
    "FR-017",
    "FR-020",
    "DATA-004",
    "DATA-005",
    "NFR-001",
    "NFR-002",
    "NFR-004",
    "NFR-005",
  ],
  evaluate(context) {
    const migrationPackages = new Set(
      context.findings
        .filter(
          (finding) =>
            finding.rule.id === "JS-MIGRATION-014" && finding.subject.type === "dependency",
        )
        .map((finding) => finding.subject.name),
    );
    const recommendations = context.findings
      .toSorted((left, right) => compareCodeUnits(left.id, right.id))
      .flatMap((finding) => {
        if (
          finding.rule.id === "JS-NPM-006" &&
          finding.subject.type === "dependency" &&
          migrationPackages.has(finding.subject.name)
        ) {
          return [];
        }

        const recommendation = recommendationFor(finding);
        return recommendation === undefined ? [] : [recommendation];
      });

    return { recommendations };
  },
};
