import { AnalysisReportV2Schema } from "@stacklens/contracts";

import { createRepositoryReportFixture } from "../repository-analysis/test-fixture.js";

export function reportV2Fixture() {
  const legacy = createRepositoryReportFixture();
  const base = {
    rule: { id: "JS-INSPECTION-018", version: "1" },
    requirementIds: ["FR-020"],
    evidenceIds: ["evidence-manifest"],
  };
  const facts = [
    ...[".", "packages/ui"].map((path, index) => ({
      ...base,
      id: "workspace-" + index,
      type: "project.workspace.package",
      subject: { type: "project", name: path },
      statement: "Inspected manifest.",
      details: {
        kind: "workspace_package",
        package: {
          id: "package-" + index,
          path,
          manifestPath: path === "." ? "package.json" : path + "/package.json",
          role: "package",
          name: index === 0 ? "root" : "ui",
        },
      },
    })),
    ...["pass", "fail", "unknown", "not_applicable"].map((state, index) => ({
      ...base,
      id: "check-" + index,
      type: "project.inspection.check",
      subject: { type: "project_setup", name: "check " + index },
      statement: "Fixture inspection check " + index + ".",
      details: {
        kind: "inspection_check",
        key: "check-" + index,
        packagePath: index === 0 ? "." : "packages/ui",
        category:
          index === 0
            ? "dependencies"
            : index === 1
              ? "testing"
              : index === 2
                ? "tooling"
                : "maintainability",
        state,
        limitationIds: state === "unknown" ? [legacy.limitations[0]!.id] : [],
      },
    })),
  ];
  const score = {
    scope: "Reported fixture scope",
    rationale: "Reported fixture decision",
    checkCounts: { passed: 0, failed: 0, unknown: 0, notApplicable: 0 },
    checkFactIds: [],
  };
  const na = { ...score, status: "not_applicable" };
  const available = {
    ...score,
    status: "available",
    value: 100,
    band: "none",
    contributionIds: [],
    checkCounts: { ...score.checkCounts, passed: 1 },
    checkFactIds: ["check-0"],
  };
  const unknown = {
    ...score,
    status: "insufficient_evidence",
    limitationIds: [legacy.limitations[0]!.id],
    checkCounts: { ...score.checkCounts, unknown: 1 },
    checkFactIds: ["check-2"],
  };
  const finding = legacy.findings[0]!;
  return AnalysisReportV2Schema.parse({
    ...legacy,
    schemaVersion: "2.0.0",
    analyzer: {
      version: "javascript-production-v4",
      ruleSetVersion: "javascript-rules-v4",
      scoringVersion: "stack-health-v3",
    },
    facts,
    findings: [
      {
        ...finding,
        id: "opportunity",
        disposition: "opportunity",
        packagePath: ".",
        title: "Update package opportunity",
        factIds: [],
      },
      {
        ...finding,
        id: "issue",
        disposition: "issue",
        packagePath: "packages/ui",
        title: "Confirmed package issue",
        factIds: [],
      },
    ],
    recommendations: [],
    scores: {
      overall: {
        ...unknown,
        rationale: "A required category is unknown. Overall scoring remains unavailable.",
        checkFactIds: ["check-0", "check-1", "check-2", "check-3"],
        checkCounts: { passed: 1, failed: 1, unknown: 1, notApplicable: 1 },
      },
      categories: {
        dependencies: available,
        security: na,
        maintainability: {
          ...na,
          checkFactIds: ["check-3"],
          checkCounts: { ...score.checkCounts, notApplicable: 1 },
        },
        testing: {
          ...available,
          value: 0,
          band: undefined,
          checkFactIds: ["check-1"],
          checkCounts: { ...score.checkCounts, failed: 1 },
        },
        tooling: unknown,
      },
      contributions: [],
    },
  });
}
