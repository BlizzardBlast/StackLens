import type { FindingCandidate, FindingRule } from "@stacklens/analyzer-core";
import type { AnalysisLimitation } from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import type { NormalizedPackageManifest } from "./manifest.js";
import { latestDistTag, packageVersion, resolveNpmObservation } from "./npm-rule-support.js";
import {
  createDependencyRuleLimitation,
  dependencyFactBases,
  truncate,
  uniqueSorted,
} from "./rule-support.js";
import {
  newerVersionDifference,
  parseExactSemanticVersion,
  type SemanticVersionDifference,
} from "./semver.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-NPM-006";
const RULE_VERSION = "1";

export function outdatedDependencyFindingId(
  packageName: string,
  declaredVersion: string,
  comparisonVersion: string,
): string {
  return `finding-js-npm-outdated-${stableHash(
    JSON.stringify([packageName, declaredVersion, comparisonVersion]),
  )}`;
}

function differenceDescription(difference: SemanticVersionDifference): string {
  return difference === "prerelease"
    ? "a prerelease-to-release semantic-version difference"
    : `a ${difference}-version difference`;
}

export const outdatedDependencyRule: FindingRule<
  NormalizedPackageManifest,
  JavaScriptAnalysisMetadata
> = {
  kind: "finding",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-006",
    "DATA-001",
    "DATA-002",
    "DATA-003",
    "DATA-005",
    "NFR-001",
    "NFR-002",
    "NFR-003",
    "NFR-004",
    "SEC-002",
  ],
  evaluate(context) {
    const findings: FindingCandidate[] = [];
    const limitations: AnalysisLimitation[] = [];

    for (const basis of dependencyFactBases(context.facts)) {
      const declared = parseExactSemanticVersion(basis.declaredSpecifier);

      if (declared === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "insufficient_evidence",
            "npm-exact-version-required",
            JSON.stringify([basis.packageName, basis.declaredSpecifier]),
            `Outdated-dependency analysis preserves declared specifier ${JSON.stringify(
              basis.declaredSpecifier,
            )} for ${basis.packageName}, but it is not an exact semantic version. A resolved exact version is required before comparing it with npm Registry releases.`,
            [],
          ),
        );
        continue;
      }

      const resolved = resolveNpmObservation({
        ruleId: RULE_ID,
        packageName: basis.packageName,
        metadata: context.metadata,
        sources: context.sources,
        evidence: context.evidence,
      });

      limitations.push(...resolved.limitations);

      if (!resolved.ok) {
        continue;
      }

      const declaredVersionRecord = packageVersion(
        resolved.observation.snapshot,
        basis.declaredSpecifier,
      );

      if (declaredVersionRecord === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-declared-version-missing",
            JSON.stringify([basis.packageName, basis.declaredSpecifier]),
            `npm Registry metadata for ${basis.packageName} does not contain declared exact version ${basis.declaredSpecifier}, so an outdated comparison is not supported.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const latest = latestDistTag(resolved.observation.snapshot);

      if (latest === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-latest-tag-missing",
            basis.packageName,
            `npm Registry metadata for ${basis.packageName} does not contain the latest dist-tag required for comparison.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const comparisonVersionRecord = packageVersion(resolved.observation.snapshot, latest.version);

      if (comparisonVersionRecord === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-comparison-version-missing",
            JSON.stringify([basis.packageName, latest.version]),
            `npm Registry latest dist-tag for ${basis.packageName} points to ${latest.version}, but that version record is unavailable.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const comparison = parseExactSemanticVersion(latest.version);

      if (comparison === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-comparison-version-invalid",
            JSON.stringify([basis.packageName, latest.version]),
            `npm Registry latest version ${JSON.stringify(
              latest.version,
            )} for ${basis.packageName} is not a supported exact semantic version.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const difference = newerVersionDifference(declared, comparison);

      if (difference === undefined) {
        continue;
      }

      const evidenceIds = uniqueSorted([
        ...basis.facts.flatMap((fact) => fact.evidenceIds),
        ...resolved.observation.evidence.map((item) => item.id),
      ]);

      findings.push({
        id: outdatedDependencyFindingId(basis.packageName, basis.declaredSpecifier, latest.version),
        category: "dependencies",
        classification: "fact",
        subject: {
          type: "dependency",
          name: basis.packageName,
          path: "package.json",
        },
        title: truncate(
          `Newer npm release available for ${basis.packageName}: ${basis.declaredSpecifier} → ${latest.version}`,
          500,
        ),
        description: truncate(
          `The project declares exact version ${basis.declaredSpecifier} for ${basis.packageName}. npm Registry's latest dist-tag points to ${latest.version}, which is newer and represents ${differenceDescription(
            difference,
          )}.`,
          4_000,
        ),
        rule: {
          id: RULE_ID,
          version: RULE_VERSION,
        },
        requirementIds: ["FR-006", "DATA-001", "DATA-002", "DATA-003"],
        evidenceIds: [...evidenceIds],
        factIds: basis.facts.map((fact) => fact.id),
        limitationIds: [...resolved.observation.limitationIds],
      });
    }

    return {
      findings,
      limitations,
    };
  },
};
