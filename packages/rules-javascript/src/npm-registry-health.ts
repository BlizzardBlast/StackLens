import type { FactRule } from "@stacklens/analyzer-core";
import type { AnalysisFact, AnalysisLimitation } from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import { dependencyInventoryEvidenceId } from "./dependency-inventory.js";
import type { NormalizedPackageManifest } from "./manifest.js";
import { latestDistTag, packageVersion, resolveNpmObservation } from "./npm-rule-support.js";
import {
  createRuleLimitation,
  dependencyDeclarationBases,
  truncate,
  uniqueSorted,
} from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-NPM-010";
const RULE_VERSION = "1";

export function npmRegistryHealthFactId(packageName: string): string {
  return `fact-js-npm-health-${stableHash(packageName)}`;
}

export const npmRegistryHealthFactRule: FactRule<
  NormalizedPackageManifest,
  JavaScriptAnalysisMetadata
> = {
  kind: "fact",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: ["FR-010", "DATA-001", "DATA-002", "DATA-005", "NFR-003"],
  evaluate(context) {
    const facts: AnalysisFact[] = [];
    const limitations: AnalysisLimitation[] = [];

    for (const basis of dependencyDeclarationBases(context.project)) {
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
          createRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-latest-tag-missing",
            basis.packageName,
            `npm Registry metadata for ${basis.packageName} does not contain the latest dist-tag required for the supported health signal.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const latestVersion = packageVersion(resolved.observation.snapshot, latest.version);

      if (latestVersion === undefined) {
        limitations.push(
          createRuleLimitation(
            RULE_ID,
            "external_data",
            "npm-latest-version-missing",
            JSON.stringify([basis.packageName, latest.version]),
            `npm Registry metadata for ${basis.packageName} points latest to ${latest.version}, but that version record is unavailable.`,
            [resolved.observation.source.id],
          ),
        );
        continue;
      }

      const parts = [`npm Registry latest dist-tag for ${basis.packageName} is ${latest.version}`];

      if (latestVersion.publishedAt !== undefined) {
        parts.push(`that release was published at ${latestVersion.publishedAt}`);
      }

      if (resolved.observation.snapshot.registryModifiedAt !== undefined) {
        parts.push(
          `the package metadata was last modified at ${resolved.observation.snapshot.registryModifiedAt}`,
        );
      }

      const projectEvidenceIds = basis.declarations.map(dependencyInventoryEvidenceId);
      const evidenceIds = uniqueSorted([
        ...projectEvidenceIds,
        ...resolved.observation.evidence.map((item) => item.id),
      ]);

      facts.push({
        id: npmRegistryHealthFactId(basis.packageName),
        type: "dependency.health.npm_registry",
        subject: {
          type: "dependency",
          name: basis.packageName,
          path: "package.json",
        },
        statement: truncate(`${parts.join("; ")}.`, 4_000),
        rule: {
          id: RULE_ID,
          version: RULE_VERSION,
        },
        requirementIds: ["FR-010"],
        evidenceIds: [...evidenceIds],
      });
    }

    return {
      facts,
      limitations,
    };
  },
};
