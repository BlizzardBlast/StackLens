import type { FindingCandidate, FindingRule } from "@stacklens/analyzer-core";
import type { AnalysisLimitation } from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import { packageVersion, resolveNpmObservation } from "./npm-rule-support.js";
import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import {
  createDependencyRuleLimitation,
  dependencyFactBases,
  effectiveDependencyVersion,
  truncate,
  uniqueSorted,
} from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-NPM-007";
const RULE_VERSION = "2";

export function deprecatedDependencyFindingId(
  packageName: string,
  declaredVersion: string,
): string {
  return `finding-js-npm-deprecated-${stableHash(JSON.stringify([packageName, declaredVersion]))}`;
}

export const deprecatedDependencyRule: FindingRule<
  JavaScriptProjectSnapshot,
  JavaScriptAnalysisMetadata
> = {
  kind: "finding",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-007",
    "FR-023",
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
      const effective = effectiveDependencyVersion(
        context.project,
        basis.packageName,
        basis.declaredSpecifier,
      );

      if (effective === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "insufficient_evidence",
            "npm-resolved-version-required",
            JSON.stringify([basis.packageName, basis.declaredSpecifier]),
            `Deprecation analysis preserves declared specifier ${JSON.stringify(
              basis.declaredSpecifier,
            )} for ${basis.packageName}, but no supported exact current version can be established from package.json or a matching root lockfile.`,
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

      const version = packageVersion(resolved.observation.snapshot, effective.version);

      if (version === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-current-version-missing",
            JSON.stringify([basis.packageName, effective.version]),
            `npm Registry metadata for ${basis.packageName} does not contain resolved current version ${effective.version}, so version-specific deprecation cannot be evaluated.`,
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
        ...effective.evidenceIds,
        ...resolved.observation.evidence.map((item) => item.id),
      ]);

      findings.push({
        id: deprecatedDependencyFindingId(basis.packageName, effective.version),
        category: "dependencies",
        classification: "fact",
        subject: {
          type: "dependency",
          name: basis.packageName,
          path: "package.json",
        },
        title: truncate(`Deprecated npm dependency ${basis.packageName}@${effective.version}`, 500),
        description: truncate(
          `package.json declares ${JSON.stringify(
            basis.declaredSpecifier,
          )} for ${basis.packageName}; StackLens established current exact version ${effective.version} from ${effective.source === "lockfile" ? "the supported root lockfile" : "the exact manifest declaration"}. npm Registry explicitly marks ${basis.packageName}@${effective.version} as deprecated: ${version.deprecatedMessage}`,
          4_000,
        ),
        rule: {
          id: RULE_ID,
          version: RULE_VERSION,
        },
        requirementIds: ["FR-007", "FR-023", "DATA-001", "DATA-002", "DATA-003"],
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
