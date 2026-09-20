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
import { newerVersionDifference, parseExactSemanticVersion } from "./semver.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-MIGRATION-014";
const RULE_VERSION = "1";

export function migrationOpportunityFindingId(
  packageName: string,
  currentVersion: string,
  targetVersion: string,
): string {
  return `finding-js-migration-${stableHash(
    JSON.stringify([packageName, currentVersion, targetVersion]),
  )}`;
}

export const migrationOpportunityRule: FindingRule<
  NormalizedPackageManifest,
  JavaScriptAnalysisMetadata
> = {
  kind: "finding",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-014",
    "FR-017",
    "FR-021",
    "DATA-001",
    "DATA-002",
    "DATA-003",
    "DATA-004",
    "NFR-001",
    "NFR-002",
    "NFR-003",
    "NFR-004",
  ],
  evaluate(context) {
    const findings: FindingCandidate[] = [];
    const limitations: AnalysisLimitation[] = [];

    for (const basis of dependencyFactBases(context.facts)) {
      const currentVersion = parseExactSemanticVersion(basis.declaredSpecifier);

      if (currentVersion === undefined) {
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

      const latest = latestDistTag(resolved.observation.snapshot);

      if (latest === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "insufficient_evidence",
            "migration-latest-tag-missing",
            basis.packageName,
            `npm Registry metadata for ${basis.packageName} does not expose the latest dist-tag required to identify a supported migration target.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const targetRecord = packageVersion(resolved.observation.snapshot, latest.version);
      const targetVersion = parseExactSemanticVersion(latest.version);

      if (targetRecord === undefined || targetVersion === undefined) {
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "insufficient_evidence",
            "migration-target-version-missing",
            JSON.stringify([basis.packageName, latest.version]),
            `npm Registry latest metadata for ${basis.packageName} points to ${latest.version}, but StackLens lacks a supported exact target-version record.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      if (newerVersionDifference(currentVersion, targetVersion) !== "major") {
        continue;
      }

      const factIds = basis.facts.map((fact) => fact.id);
      const evidenceIds = uniqueSorted([
        ...basis.facts.flatMap((fact) => fact.evidenceIds),
        ...resolved.observation.evidence.map((evidence) => evidence.id),
      ]);

      findings.push({
        id: migrationOpportunityFindingId(
          basis.packageName,
          basis.declaredSpecifier,
          latest.version,
        ),
        category: "maintainability",
        classification: "heuristic",
        subject: {
          type: "dependency",
          name: basis.packageName,
          path: "package.json",
        },
        title: truncate(
          `Major-version migration opportunity: ${basis.packageName} ${basis.declaredSpecifier} → ${latest.version}`,
          500,
        ),
        description: truncate(
          `${basis.packageName} is declared at exact version ${basis.declaredSpecifier}, while the npm Registry latest dist-tag resolves to ${latest.version}. The major version differs, so StackLens identifies a migration-review opportunity rather than a routine update. Reviewing the migration can reduce long-term version drift and make breaking compatibility work explicit before it becomes urgent. This does not make the migration mandatory; compatibility, release notes, and project-specific behavior still require review.`,
          4_000,
        ),
        rule: {
          id: RULE_ID,
          version: RULE_VERSION,
        },
        requirementIds: ["FR-014", "DATA-001", "DATA-002", "DATA-003", "DATA-004"],
        evidenceIds: [...evidenceIds],
        factIds,
        limitationIds: [...resolved.observation.limitationIds],
        confidence: {
          level: "medium",
          rationale:
            "The current and target exact versions are deterministic npm/project evidence and cross a semantic major-version boundary, but whether the project benefits from migrating depends on compatibility and project-specific needs.",
          factIds,
        },
      });
    }

    return { findings, limitations };
  },
};
