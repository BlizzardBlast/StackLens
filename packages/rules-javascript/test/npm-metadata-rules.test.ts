import { describe, expect, it } from "vitest";

import type { DataSource, ExternalEvidence } from "@stacklens/contracts";

import type {
  JavaScriptAnalysisMetadata,
  JavaScriptNpmPackageSnapshot,
} from "../src/analysis-metadata.js";
import {
  createDependencyInventoryEvidence,
  dependencyInventoryRule,
} from "../src/dependency-inventory.js";
import {
  deprecatedDependencyFindingId,
  deprecatedDependencyRule,
} from "../src/deprecated-dependency.js";
import { normalizePackageManifest } from "../src/manifest.js";
import { npmRegistryHealthFactId, npmRegistryHealthFactRule } from "../src/npm-registry-health.js";
import { outdatedDependencyFindingId, outdatedDependencyRule } from "../src/outdated-dependency.js";
import {
  compareSemanticVersions,
  newerVersionDifference,
  parseExactSemanticVersion,
} from "../src/semver.js";

const retrievedAt = "2026-09-19T09:00:00Z";
const packageName = "example-package";
const sourceId = "source-npm-example";
const registryReference = "https://registry.npmjs.org/example-package";
const npmEvidenceId = "evidence-npm-example";

const availableSource: DataSource = {
  id: sourceId,
  provider: "npm-registry",
  status: "available",
  retrievedAt,
  reference: registryReference,
};

const npmEvidence: ExternalEvidence = {
  id: npmEvidenceId,
  kind: "external",
  sourceId,
  summary: "npm Registry package metadata for example-package",
  reference: registryReference,
  url: registryReference,
};

function createSnapshot(
  overrides: Partial<JavaScriptNpmPackageSnapshot> = {},
): JavaScriptNpmPackageSnapshot {
  return {
    packageName,
    registryCreatedAt: "2025-01-01T00:00:00Z",
    registryModifiedAt: "2026-09-18T12:00:00Z",
    distTags: [
      {
        tag: "latest",
        version: "2.0.0",
      },
    ],
    versions: [
      {
        version: "1.0.0",
        deprecatedMessage: "Use 2.x instead.",
        publishedAt: "2025-01-01T00:00:00Z",
      },
      {
        version: "1.5.0",
        publishedAt: "2025-06-01T00:00:00Z",
      },
      {
        version: "2.0.0-beta.1",
        publishedAt: "2026-01-01T00:00:00Z",
      },
      {
        version: "2.0.0",
        publishedAt: "2026-09-18T12:00:00Z",
      },
    ],
    ...overrides,
  };
}

function createMetadata(
  snapshot: JavaScriptNpmPackageSnapshot = createSnapshot(),
  metadataSourceId = sourceId,
): JavaScriptAnalysisMetadata {
  return {
    npmRegistry: [
      {
        sourceId: metadataSourceId,
        snapshot,
      },
    ],
  };
}

function createRuleContext(options: {
  readonly manifest?: unknown;
  readonly metadata?: JavaScriptAnalysisMetadata;
  readonly sources?: readonly DataSource[];
  readonly externalEvidence?: readonly ExternalEvidence[];
}) {
  const project = normalizePackageManifest(
    options.manifest ?? {
      dependencies: {
        [packageName]: "1.0.0",
      },
    },
  );
  const projectEvidence = createDependencyInventoryEvidence(project);
  const factResult = dependencyInventoryRule.evaluate({
    input: {
      type: "manifest",
      fingerprint: "sha256:npm-rule-fixture",
    },
    project,
    metadata: {},
    sources: [],
    evidence: projectEvidence,
    limitations: [],
    partialFailures: [],
  });

  return {
    project,
    projectEvidence,
    factResult,
    context: {
      input: {
        type: "manifest" as const,
        fingerprint: "sha256:npm-rule-fixture",
      },
      project,
      metadata: options.metadata ?? createMetadata(),
      sources: [...(options.sources ?? [availableSource])],
      evidence: [...projectEvidence, ...(options.externalEvidence ?? [npmEvidence])],
      limitations: [],
      partialFailures: [],
      facts: factResult.facts ?? [],
    },
  };
}

describe("semantic version support [FR-006]", () => {
  it("accepts exact semantic versions and rejects ranges, tags, short versions, and invalid numeric prereleases", () => {
    expect(parseExactSemanticVersion("1.2.3")).toBeDefined();
    expect(parseExactSemanticVersion("1.2.3-beta.1+build.7")).toBeDefined();
    expect(parseExactSemanticVersion("^1.2.3")).toBeUndefined();
    expect(parseExactSemanticVersion("latest")).toBeUndefined();
    expect(parseExactSemanticVersion("1.2")).toBeUndefined();
    expect(parseExactSemanticVersion("1.2.3-01")).toBeUndefined();
  });

  it("implements SemVer prerelease precedence and classifies newer differences", () => {
    const beta = parseExactSemanticVersion("2.0.0-beta.1")!;
    const stable = parseExactSemanticVersion("2.0.0")!;
    const minor = parseExactSemanticVersion("1.5.0")!;
    const major = parseExactSemanticVersion("2.0.0")!;
    const patch = parseExactSemanticVersion("1.5.1")!;

    expect(compareSemanticVersions(beta, stable)).toBeLessThan(0);
    expect(newerVersionDifference(beta, stable)).toBe("prerelease");
    expect(newerVersionDifference(minor, major)).toBe("major");
    expect(newerVersionDifference(minor, patch)).toBe("patch");
    expect(
      newerVersionDifference(
        parseExactSemanticVersion("1.4.9")!,
        parseExactSemanticVersion("1.5.0")!,
      ),
    ).toBe("minor");
  });
});

describe("npmRegistryHealthFactRule [FR-010, DATA-001, DATA-002, NFR-003]", () => {
  it("emits one neutral npm Registry health signal per declared package with source evidence", () => {
    const fixture = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "1.0.0",
        },
        optionalDependencies: {
          [packageName]: "^1.0.0",
        },
      },
    });

    const result = npmRegistryHealthFactRule.evaluate({
      input: fixture.context.input,
      project: fixture.project,
      metadata: fixture.context.metadata,
      sources: fixture.context.sources,
      evidence: fixture.context.evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.limitations).toEqual([]);
    expect(result.facts).toHaveLength(1);
    expect(result.facts?.[0]).toMatchObject({
      id: npmRegistryHealthFactId(packageName),
      type: "dependency.health.npm_registry",
      subject: {
        type: "dependency",
        name: packageName,
        path: "package.json",
      },
      rule: {
        id: "JS-NPM-010",
        version: "1",
      },
      requirementIds: ["FR-010"],
    });
    expect(result.facts?.[0]?.statement).toContain("latest dist-tag");
    expect(result.facts?.[0]?.statement).toContain("2.0.0");
    expect(result.facts?.[0]?.statement).toContain("published at 2026-09-18T12:00:00Z");
    expect(result.facts?.[0]?.statement).toContain("metadata was last modified");
    expect(result.facts?.[0]?.evidenceIds).toHaveLength(3);
    expect(result.facts?.[0]?.evidenceIds).toContain(npmEvidenceId);
    expect(result.facts?.[0]?.statement.toLowerCase()).not.toContain("healthy");
    expect(result.facts?.[0]?.statement.toLowerCase()).not.toContain("unhealthy");
  });

  it("retains observed health metadata from a partial source while disclosing the limitation", () => {
    const partialSource: DataSource = {
      ...availableSource,
      status: "partial",
    };
    const fixture = createRuleContext({
      sources: [partialSource],
    });

    const result = npmRegistryHealthFactRule.evaluate({
      input: fixture.context.input,
      project: fixture.project,
      metadata: fixture.context.metadata,
      sources: fixture.context.sources,
      evidence: fixture.context.evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts).toHaveLength(1);
    expect(result.limitations).toEqual([
      expect.objectContaining({
        kind: "partial_failure",
        sourceIds: [sourceId],
        ruleIds: ["JS-NPM-010"],
      }),
    ]);
  });

  it("does not emit a signal without the latest tag or exact bound-source evidence", () => {
    const missingLatest = createRuleContext({
      metadata: createMetadata(
        createSnapshot({
          distTags: [],
        }),
      ),
    });
    const missingLatestResult = npmRegistryHealthFactRule.evaluate({
      input: missingLatest.context.input,
      project: missingLatest.project,
      metadata: missingLatest.context.metadata,
      sources: missingLatest.context.sources,
      evidence: missingLatest.context.evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(missingLatestResult.facts).toEqual([]);
    expect(missingLatestResult.limitations?.[0]?.message).toContain("latest dist-tag");

    const wrongEvidenceSource: ExternalEvidence = {
      ...npmEvidence,
      id: "evidence-npm-decoy",
      sourceId: "source-npm-decoy",
    };
    const missingEvidence = createRuleContext({
      externalEvidence: [wrongEvidenceSource],
    });
    const missingEvidenceResult = npmRegistryHealthFactRule.evaluate({
      input: missingEvidence.context.input,
      project: missingEvidence.project,
      metadata: missingEvidence.context.metadata,
      sources: missingEvidence.context.sources,
      evidence: missingEvidence.context.evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(missingEvidenceResult.facts).toEqual([]);
    expect(missingEvidenceResult.limitations?.[0]).toMatchObject({
      kind: "external_data",
      sourceIds: [sourceId],
    });
  });
});

describe("outdatedDependencyRule [FR-006, FR-023, DATA-001, DATA-002, DATA-003, NFR-003]", () => {
  it("emits one factual major-version finding for duplicate declarations of the same exact version", () => {
    const fixture = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "1.0.0",
        },
        optionalDependencies: {
          [packageName]: "1.0.0",
        },
      },
    });

    const result = outdatedDependencyRule.evaluate(fixture.context);

    expect(result.limitations).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings?.[0]).toMatchObject({
      id: outdatedDependencyFindingId(packageName, "1.0.0", "2.0.0"),
      category: "dependencies",
      classification: "fact",
      rule: {
        id: "JS-NPM-006",
        version: "2",
      },
      requirementIds: ["FR-006", "FR-023", "DATA-001", "DATA-002", "DATA-003"],
      limitationIds: [],
    });
    expect(result.findings?.[0]?.factIds).toHaveLength(2);
    expect(result.findings?.[0]?.evidenceIds).toHaveLength(3);
    expect(result.findings?.[0]?.description).toContain("major-version difference");
    expect(result.findings?.[0]?.description).toContain("1.0.0");
    expect(result.findings?.[0]?.description).toContain("2.0.0");
  });

  it.each([
    ["1.4.9", "1.5.0", "minor-version difference"],
    ["1.5.0", "1.5.1", "patch-version difference"],
    ["2.0.0-beta.1", "2.0.0", "prerelease-to-release semantic-version difference"],
  ])("distinguishes %s -> %s as %s", (declaredVersion, comparisonVersion, expectedDifference) => {
    const fixture = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: declaredVersion,
        },
      },
      metadata: createMetadata(
        createSnapshot({
          distTags: [
            {
              tag: "latest",
              version: comparisonVersion,
            },
          ],
          versions: [
            {
              version: declaredVersion,
            },
            {
              version: comparisonVersion,
            },
          ],
        }),
      ),
    });

    const result = outdatedDependencyRule.evaluate(fixture.context);

    expect(result.findings).toHaveLength(1);
    expect(result.findings?.[0]?.description).toContain(expectedDifference);
  });

  it("emits no outdated finding when latest is equal to or older than the exact declared version", () => {
    const equal = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "2.0.0",
        },
      },
    });
    const older = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "2.0.0",
        },
      },
      metadata: createMetadata(
        createSnapshot({
          distTags: [
            {
              tag: "latest",
              version: "1.5.0",
            },
          ],
        }),
      ),
    });

    expect(outdatedDependencyRule.evaluate(equal.context).findings).toEqual([]);
    expect(outdatedDependencyRule.evaluate(older.context).findings).toEqual([]);
  });

  it("keeps ranges and tags as insufficient exact-version evidence", () => {
    for (const declaredSpecifier of ["^1.0.0", "~1.0.0", "latest"]) {
      const fixture = createRuleContext({
        manifest: {
          dependencies: {
            [packageName]: declaredSpecifier,
          },
        },
      });
      const result = outdatedDependencyRule.evaluate(fixture.context);

      expect(result.findings).toEqual([]);
      expect(result.limitations).toEqual([
        expect.objectContaining({
          kind: "insufficient_evidence",
          sourceIds: [],
          ruleIds: ["JS-NPM-006"],
          message: expect.stringContaining("exact current version"),
        }),
      ]);
    }
  });

  it("retains an observed outdated match from a partial source and attaches its limitation", () => {
    const partialSource: DataSource = {
      ...availableSource,
      status: "partial",
    };
    const fixture = createRuleContext({
      sources: [partialSource],
    });
    const result = outdatedDependencyRule.evaluate(fixture.context);

    expect(result.findings).toHaveLength(1);
    expect(result.limitations).toHaveLength(1);
    expect(result.findings?.[0]?.limitationIds).toEqual([result.limitations?.[0]?.id]);
  });

  it("rejects missing metadata, missing bound sources, cross-source evidence, absent version records, and invalid comparison versions", () => {
    const missingMetadata = createRuleContext({
      metadata: {},
    });
    expect(outdatedDependencyRule.evaluate(missingMetadata.context).findings).toEqual([]);

    const missingSource = createRuleContext({
      sources: [],
    });
    expect(outdatedDependencyRule.evaluate(missingSource.context).limitations?.[0]).toMatchObject({
      kind: "external_data",
      sourceIds: [],
    });

    const decoySource: DataSource = {
      id: "source-npm-decoy",
      provider: "npm-registry",
      status: "available",
      retrievedAt,
      reference: registryReference,
    };
    const crossSource = createRuleContext({
      sources: [availableSource, decoySource],
      externalEvidence: [
        {
          ...npmEvidence,
          id: "evidence-npm-decoy",
          sourceId: decoySource.id,
        },
      ],
    });
    expect(outdatedDependencyRule.evaluate(crossSource.context).findings).toEqual([]);
    expect(
      outdatedDependencyRule.evaluate(crossSource.context).limitations?.[0]?.message,
    ).toContain("exact bound data source");

    const missingDeclaredRecord = createRuleContext({
      metadata: createMetadata(
        createSnapshot({
          versions: [
            {
              version: "2.0.0",
            },
          ],
        }),
      ),
    });
    expect(outdatedDependencyRule.evaluate(missingDeclaredRecord.context).findings).toEqual([]);
    expect(
      outdatedDependencyRule.evaluate(missingDeclaredRecord.context).limitations?.[0]?.message,
    ).toContain("does not contain resolved current version");

    const missingComparisonRecord = createRuleContext({
      metadata: createMetadata(
        createSnapshot({
          versions: [
            {
              version: "1.0.0",
            },
          ],
        }),
      ),
    });
    expect(outdatedDependencyRule.evaluate(missingComparisonRecord.context).findings).toEqual([]);
    expect(
      outdatedDependencyRule.evaluate(missingComparisonRecord.context).limitations?.[0]?.message,
    ).toContain("version record is unavailable");

    const invalidLatest = createRuleContext({
      metadata: createMetadata(
        createSnapshot({
          distTags: [
            {
              tag: "latest",
              version: "not-semver",
            },
          ],
          versions: [
            {
              version: "1.0.0",
            },
            {
              version: "not-semver",
            },
          ],
        }),
      ),
    });
    expect(outdatedDependencyRule.evaluate(invalidLatest.context).findings).toEqual([]);
    expect(
      outdatedDependencyRule.evaluate(invalidLatest.context).limitations?.[0]?.message,
    ).toContain("not a supported exact semantic version");
  });
});

describe("deprecatedDependencyRule [FR-007, FR-023, DATA-001, DATA-002, DATA-003, NFR-003]", () => {
  it("emits a factual finding for explicit version-specific npm deprecation", () => {
    const fixture = createRuleContext({});
    const result = deprecatedDependencyRule.evaluate(fixture.context);

    expect(result.limitations).toEqual([]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings?.[0]).toMatchObject({
      id: deprecatedDependencyFindingId(packageName, "1.0.0"),
      category: "dependencies",
      classification: "fact",
      rule: {
        id: "JS-NPM-007",
        version: "2",
      },
      requirementIds: ["FR-007", "FR-023", "DATA-001", "DATA-002", "DATA-003"],
      limitationIds: [],
    });
    expect(result.findings?.[0]?.description).toContain("Use 2.x instead.");
    expect(result.findings?.[0]?.evidenceIds).toContain(npmEvidenceId);
  });

  it("emits no deprecation finding when the exact version has no explicit npm deprecation", () => {
    const fixture = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "1.5.0",
        },
      },
    });
    const result = deprecatedDependencyRule.evaluate(fixture.context);

    expect(result.findings).toEqual([]);
    expect(result.limitations).toEqual([]);
  });

  it("does not reinterpret a range as a deprecated installed version", () => {
    const fixture = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "^1.0.0",
        },
      },
    });
    const result = deprecatedDependencyRule.evaluate(fixture.context);

    expect(result.findings).toEqual([]);
    expect(result.limitations).toEqual([
      expect.objectContaining({
        kind: "insufficient_evidence",
        sourceIds: [],
        ruleIds: ["JS-NPM-007"],
      }),
    ]);
  });

  it("reports missing exact-version metadata instead of inventing a deprecation conclusion", () => {
    const fixture = createRuleContext({
      manifest: {
        dependencies: {
          [packageName]: "1.1.0",
        },
      },
    });
    const result = deprecatedDependencyRule.evaluate(fixture.context);

    expect(result.findings).toEqual([]);
    expect(result.limitations).toEqual([
      expect.objectContaining({
        kind: "external_data",
        sourceIds: [sourceId],
        message: expect.stringContaining("does not contain resolved current version"),
      }),
    ]);
  });

  it("keeps explicit deprecation factual on a partial source while attaching the source limitation", () => {
    const partialSource: DataSource = {
      ...availableSource,
      status: "partial",
    };
    const fixture = createRuleContext({
      sources: [partialSource],
    });
    const result = deprecatedDependencyRule.evaluate(fixture.context);

    expect(result.findings).toHaveLength(1);
    expect(result.limitations).toHaveLength(1);
    expect(result.findings?.[0]?.limitationIds).toEqual([result.limitations?.[0]?.id]);
  });

  it("does not emit an unmaintained heuristic without an accepted deterministic basis", () => {
    const fixture = createRuleContext({});
    const result = deprecatedDependencyRule.evaluate(fixture.context);

    expect(result.findings?.some((finding) => finding.classification === "heuristic")).toBe(false);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("unmaintained");
  });
});
