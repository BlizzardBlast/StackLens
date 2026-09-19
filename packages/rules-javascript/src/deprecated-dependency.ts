import type { FindingCandidate, FindingRule } from "@stacklens/analyzer-core";
import type { AnalysisLimitation } from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import type { NormalizedPackageManifest } from "./manifest.js";
import { packageVersion, resolveNpmObservation } from "./npm-rule-support.js";
import {
  createDependencyRuleLimitation,
  dependencyFactBases,
  truncate,
  uniqueSorted,
} from "./rule-support.js";
import { parseExactSemanticVersion } from "./semver.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-NPM-007";
const RULE_VERSION = "1";

export function deprecatedDependencyFindingId(
  packageName: string,
  declaredVersion: string,
): string {
  return `finding-js-npm-deprecated-${stableHash(JSON.stringify([packageName, declaredVersion]))}`;
}

export const deprecatedDependencyRule: FindingRule<
  NormalizedPackageManifest,
  JavaScriptAnalysisMetadata
> = {
  kind: "finding",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-007",
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
      if (parseExactSemanticVersion(basis.declaredSpecifier) === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "insufficient_evidence",
            "npm-exact-version-required",
            JSON.stringify([basis.packageName, basis.declaredSpecifier]),
            `Deprecation analysis preserves declared specifier ${JSON.stringify(
              basis.declaredSpecifier,
            )} for ${basis.packageName}, but it is not an exact semantic version. A resolved exact version is required before selecting version-specific npm deprecation metadata.`,
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

      const version = packageVersion(resolved.observation.snapshot, basis.declaredSpecifier);

      if (version === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-declared-version-missing",
            JSON.stringify([basis.packageName, basis.declaredSpecifier]),
            `npm Registry metadata for ${basis.packageName} does not contain declared exact version ${basis.declaredSpecifier}, so version-specific deprecation cannot be evaluated.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      if (version.deprecatedMessage === undefined) {
        continue;
      }

      const evidenceIds = uniqueSorted([
        ...basis.facts.flatMap((fact) => fact.evidenceIds),
        ...resolved.observation.evidence.map((item) => item.id),
      ]);

      findings.push({
        id: deprecatedDependencyFindingId(basis.packageName, basis.declaredSpecifier),
        category: "dependencies",
        classification: "fact",
        subject: {
          type: "dependency",
          name: basis.packageName,
          path: "package.json",
        },
        title: truncate(
          `Deprecated npm dependency ${basis.packageName}@${basis.declaredSpecifier}`,
          500,
        ),
        description: truncate(
          `npm Registry explicitly marks ${basis.packageName}@${basis.declaredSpecifier} as deprecated: ${version.deprecatedMessage}`,
          4_000,
        ),
        rule: {
          id: RULE_ID,
          version: RULE_VERSION,
        },
        requirementIds: ["FR-007", "DATA-001", "DATA-002", "DATA-003"],
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
