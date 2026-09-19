import type { DataSource, ExternalEvidence } from "@stacklens/contracts";

import type {
  JavaScriptAnalysisMetadata,
  JavaScriptNpmMetadata,
  JavaScriptNpmPackageSnapshot,
} from "./analysis-metadata.js";
import { compareCodeUnits, createRuleLimitation } from "./rule-support.js";

export const NPM_REGISTRY_PROVIDER_ID = "npm-registry";

export interface NpmObservation {
  readonly source: Exclude<DataSource, { readonly status: "unavailable" }>;
  readonly snapshot: JavaScriptNpmPackageSnapshot;
  readonly evidence: readonly ExternalEvidence[];
  readonly limitationIds: readonly string[];
}

export type NpmObservationResolution =
  | {
      readonly ok: true;
      readonly observation: NpmObservation;
      readonly limitations: readonly ReturnType<typeof createRuleLimitation>[];
    }
  | {
      readonly ok: false;
      readonly limitations: readonly ReturnType<typeof createRuleLimitation>[];
    };

function npmMetadataForPackage(
  metadata: JavaScriptAnalysisMetadata,
  packageName: string,
): readonly JavaScriptNpmMetadata[] {
  return (metadata.npmRegistry ?? [])
    .filter((entry) => entry.snapshot.packageName === packageName)
    .toSorted((left, right) => compareCodeUnits(left.sourceId, right.sourceId));
}

function externalEvidenceForSource(
  evidence: readonly { readonly kind: string }[],
  source: DataSource,
): readonly ExternalEvidence[] {
  return evidence
    .filter((item): item is ExternalEvidence => item.kind === "external")
    .filter(
      (item) =>
        item.sourceId === source.id &&
        (source.reference === undefined || item.reference === source.reference),
    )
    .toSorted((left, right) => compareCodeUnits(left.id, right.id));
}

export function resolveNpmObservation(options: {
  readonly ruleId: string;
  readonly packageName: string;
  readonly metadata: JavaScriptAnalysisMetadata;
  readonly sources: readonly DataSource[];
  readonly evidence: readonly { readonly kind: string }[];
}): NpmObservationResolution {
  const entries = npmMetadataForPackage(options.metadata, options.packageName);

  if (entries.length === 0) {
    return {
      ok: false,
      limitations: [
        createRuleLimitation(
          options.ruleId,
          "insufficient_evidence",
          "npm-metadata-missing",
          options.packageName,
          `npm Registry metadata is unavailable for ${options.packageName}; provider-backed dependency analysis cannot make a supported conclusion for this package.`,
          [],
        ),
      ],
    };
  }

  if (entries.length > 1) {
    return {
      ok: false,
      limitations: [
        createRuleLimitation(
          options.ruleId,
          "insufficient_evidence",
          "npm-metadata-ambiguous",
          options.packageName,
          `Multiple normalized npm Registry snapshots are bound to ${options.packageName}; StackLens cannot select one as the authoritative observation.`,
          entries.map((entry) => entry.sourceId),
        ),
      ],
    };
  }

  const entry = entries[0]!;
  const source = options.sources.find((candidate) => candidate.id === entry.sourceId);

  if (
    source === undefined ||
    source.provider !== NPM_REGISTRY_PROVIDER_ID ||
    source.status === "unavailable"
  ) {
    return {
      ok: false,
      limitations: [
        createRuleLimitation(
          options.ruleId,
          "external_data",
          "npm-source-unavailable",
          entry.sourceId,
          `The normalized npm Registry snapshot for ${options.packageName} is bound to a missing, unavailable, or non-npm Registry data source.`,
          source === undefined ? [] : [source.id],
        ),
      ],
    };
  }

  if (entry.snapshot.packageName !== options.packageName) {
    return {
      ok: false,
      limitations: [
        createRuleLimitation(
          options.ruleId,
          "external_data",
          "npm-package-identity-mismatch",
          JSON.stringify([options.packageName, entry.snapshot.packageName]),
          `The normalized npm Registry snapshot package identity does not match analyzed dependency ${options.packageName}.`,
          [source.id],
        ),
      ],
    };
  }

  const evidence = externalEvidenceForSource(options.evidence, source);

  if (evidence.length === 0) {
    return {
      ok: false,
      limitations: [
        createRuleLimitation(
          options.ruleId,
          "external_data",
          "npm-evidence-missing",
          options.packageName,
          `npm Registry metadata for ${options.packageName} lacks report evidence tied to its exact bound data source.`,
          [source.id],
        ),
      ],
    };
  }

  const limitations =
    source.status === "partial"
      ? [
          createRuleLimitation(
            options.ruleId,
            "partial_failure",
            "npm-source-partial",
            options.packageName,
            `npm Registry metadata for ${options.packageName} is partial; observed metadata may support positive facts, but absence of additional signals is not conclusive.`,
            [source.id],
          ),
        ]
      : [];

  return {
    ok: true,
    observation: {
      source,
      snapshot: entry.snapshot,
      evidence,
      limitationIds: limitations.map((limitation) => limitation.id),
    },
    limitations,
  };
}

export function latestDistTag(
  snapshot: JavaScriptNpmPackageSnapshot,
): { readonly tag: string; readonly version: string } | undefined {
  return snapshot.distTags.find((tag) => tag.tag === "latest");
}

export function packageVersion(
  snapshot: JavaScriptNpmPackageSnapshot,
  version: string,
): JavaScriptNpmPackageSnapshot["versions"][number] | undefined {
  return snapshot.versions.find((candidate) => candidate.version === version);
}
