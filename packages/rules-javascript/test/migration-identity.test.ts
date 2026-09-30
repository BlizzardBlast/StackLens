import { describe, expect, it } from "vitest";

import { runAnalyzer } from "@stacklens/analyzer-core";
import { stackHealthScorer } from "@stacklens/scoring";

import {
  createWorkspaceProject,
  createWorkspaceEvidence,
  dependencyInventoryRule,
  migrationOpportunityRule,
  javascriptFindingPrioritizer,
  scopeFactRule,
  scopeFindingRule,
  workspaceInspectionRule,
} from "../src/index.js";

function analyze({ registry = true, differentVersion = false, members = false } = {}) {
  const declarations = {
    dependencies: { legacy: "1.0.0" },
    devDependencies: { legacy: differentVersion ? "2.0.0" : "^1.0.0" },
  };
  const manifest = {
    ...declarations,
    packageManager: "npm@11.0.0",
    ...(members ? { workspaces: ["packages/*"] } : {}),
  };
  const project = createWorkspaceProject(
    JSON.stringify(manifest),
    [
      {
        path: "package-lock.json",
        content: JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": manifest,
            "node_modules/legacy": { version: "1.0.0" },
            ...(members ? { "packages/member": declarations } : {}),
          },
        }),
      },
      ...(members
        ? [
            {
              path: "packages/member/package.json",
              content: JSON.stringify({ name: "member", ...declarations }),
            },
          ]
        : []),
    ],
    {
      complete: true,
      candidateSourceFiles: 0,
      acquiredSourceFiles: 0,
      lockfilePaths: ["package-lock.json"],
      lockfileIssueCount: 0,
    },
  );
  const source = {
    id: "source-npm-legacy",
    provider: "npm-registry",
    status: "available" as const,
    retrievedAt: "2026-09-29T00:00:00Z",
    reference: "https://registry.npmjs.org/legacy",
  };
  return runAnalyzer(
    {
      version: "regression",
      reportSchemaVersion: "2.0.0",
      ruleSet: {
        version: "regression",
        factRules: [scopeFactRule(dependencyInventoryRule), workspaceInspectionRule],
        findingRules: [scopeFindingRule(migrationOpportunityRule)],
        prioritizer: javascriptFindingPrioritizer,
        recommendationRules: [],
      },
      scorer: stackHealthScorer,
    },
    {
      analysisId: "migration-identity",
      createdAt: "2026-09-29T00:00:00Z",
      input: { type: "manifest", fingerprint: "fixture" },
      project,
      metadata: registry
        ? {
            npmRegistry: [
              {
                sourceId: source.id,
                snapshot: {
                  packageName: "legacy",
                  distTags: [{ tag: "latest", version: "3.0.0" }],
                  versions: [{ version: "1.0.0" }, { version: "2.0.0" }, { version: "3.0.0" }],
                },
              },
            ],
          }
        : {},
      sources: registry ? [source] : [],
      evidence: [
        ...createWorkspaceEvidence(project),
        ...(registry
          ? [
              {
                id: "evidence-npm-legacy",
                kind: "external" as const,
                sourceId: source.id,
                summary: "Registry fixture",
                reference: source.reference,
                url: source.reference,
              },
            ]
          : []),
      ],
    },
  );
}

describe("migration identity [FR-014, FR-017, FR-023, NFR-002]", () => {
  it("aggregates exact and ranged declarations with complete evidence and confidence references", () => {
    const report = analyze();
    expect(report.partialFailures).toEqual([]);
    expect(report.findings).toHaveLength(1);
    const finding = report.findings[0]!;
    expect(finding.factIds).toHaveLength(2);
    expect(finding.description).toContain('"1.0.0", "^1.0.0"');
    expect(finding.evidenceIds).toHaveLength(4);
    if (finding.classification !== "heuristic") throw new Error("Expected heuristic migration");
    expect(finding.confidence.factIds).toEqual(finding.factIds);
    expect(finding.rule.version).toBe("3");
  });
  it("keeps different current versions and workspace scopes distinct", () => {
    for (const options of [{ differentVersion: true }, { members: true }]) {
      const report = analyze(options);
      expect(report.partialFailures).toEqual([]);
      expect(report.findings).toHaveLength(2);
      expect(new Set(report.findings.map((finding) => finding.id)).size).toBe(2);
    }
  });
  it("deduplicates identical missing-provider limitations without masking a rule failure", () => {
    const report = analyze({ registry: false });
    expect(report.partialFailures).toEqual([]);
    expect(report.findings).toEqual([]);
    const limitations = report.limitations.filter((item) =>
      item.ruleIds.includes("JS-MIGRATION-014"),
    );
    expect(limitations).toHaveLength(1);
  });
});
