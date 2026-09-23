import type { FindingCandidate, FindingPrioritizer } from "@stacklens/analyzer-core";
import type { FindingPriority, PriorityLevel } from "@stacklens/contracts";

const RULE_ID = "JS-PRIORITY-016";
const RULE_VERSION = "1";

interface PriorityDescriptor {
  readonly level: PriorityLevel;
  readonly key: string;
  readonly rationale: string;
}

const PRIORITY_BY_RULE: Readonly<Record<string, PriorityDescriptor>> = {
  "JS-VULN-011": {
    level: "high",
    key: "known-vulnerability",
    rationale:
      "An exact dependency version is matched to a known vulnerability, so this deserves prompt attention before lower-risk maintenance findings.",
  },
  "JS-NPM-007": {
    level: "high",
    key: "explicit-deprecation",
    rationale:
      "The package registry explicitly marks the exact dependency version deprecated, increasing maintenance and future-compatibility risk.",
  },
  "JS-MIGRATION-014": {
    level: "medium",
    key: "major-version-migration",
    rationale:
      "A deterministic major-version target exists, but migration work requires compatibility review and planned testing.",
  },
  "JS-NPM-006": {
    level: "medium",
    key: "outdated-version",
    rationale:
      "A newer exact npm latest version exists; update work is important but does not by itself establish an urgent failure or vulnerability.",
  },
  "JS-OVERLAP-008": {
    level: "medium",
    key: "overlapping-responsibility",
    rationale:
      "Supported package overlap can increase configuration and maintenance surface, but actual consolidation depends on project usage.",
  },
  "JS-UNNECESSARY-009": {
    level: "low",
    key: "potential-non-use",
    rationale:
      "Supported static analysis found no usage signal, but the finding is intentionally conservative and requires verification before action.",
  },
};

const LEVEL_ORDER: Readonly<Record<PriorityLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function lowerPriority(left: PriorityLevel, right: PriorityLevel): PriorityLevel {
  return LEVEL_ORDER[left] <= LEVEL_ORDER[right] ? left : right;
}

function descriptorFor(finding: FindingCandidate): PriorityDescriptor {
  const descriptor = PRIORITY_BY_RULE[finding.rule.id];

  if (descriptor !== undefined) {
    return descriptor;
  }

  return finding.category === "security"
    ? {
        level: "high",
        key: "security-finding",
        rationale:
          "The finding belongs to the security category, so the fallback deterministic policy places it ahead of routine maintenance findings.",
      }
    : {
        level: "low",
        key: "supported-finding",
        rationale:
          "The finding has no more specific production priority mapping, so the deterministic fallback keeps it visible without overstating urgency.",
      };
}

export const javascriptFindingPrioritizer: FindingPrioritizer<unknown, unknown> = {
  kind: "priority",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: ["FR-016", "FR-020", "DATA-006", "NFR-001", "NFR-004"],
  prioritize(_context, finding): FindingPriority {
    const descriptor = descriptorFor(finding);
    const level =
      finding.classification === "heuristic"
        ? lowerPriority(
            descriptor.level,
            finding.confidence.level === "low"
              ? "low"
              : finding.confidence.level === "medium"
                ? "medium"
                : descriptor.level,
          )
        : descriptor.level;
    const factors = [
      {
        key: descriptor.key,
        rationale: descriptor.rationale,
        evidenceIds: [...finding.evidenceIds],
      },
    ];

    if (finding.classification === "heuristic") {
      factors.push({
        key: "evidence-strength",
        rationale: `The finding is heuristic with ${finding.confidence.level} confidence; priority is capped so evidence uncertainty cannot increase urgency.`,
        evidenceIds: [...finding.evidenceIds],
      });
    }

    return {
      level,
      rule: {
        id: RULE_ID,
        version: RULE_VERSION,
      },
      rationale: `${descriptor.rationale} Final priority is ${level} under the deterministic StackLens JavaScript policy.`,
      factors,
    };
  },
};
