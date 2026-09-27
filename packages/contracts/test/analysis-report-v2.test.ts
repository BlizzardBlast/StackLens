import { describe, expect, it } from "vitest";

import {
  AnalysisReportSchema,
  AnalysisReportV1Schema,
  AnalysisReportV2Schema,
} from "../src/analysis-report.js";
import { InspectionCheckDetailsSchema } from "../src/inspection.js";
import { createValidAnalysisReport } from "./fixture.js";

function reportV2() {
  const legacy = createValidAnalysisReport();
  const available = {
    status: "available" as const,
    value: 100,
    scope: "Supported inspection checks",
    rationale: "Supported checks completed.",
    checkCounts: { passed: 0, failed: 0, unknown: 0, notApplicable: 0 },
    checkFactIds: [] as string[],
    contributionIds: [] as string[],
  };
  return {
    ...legacy,
    schemaVersion: "2.0.0",
    scores: {
      overall: structuredClone(available),
      categories: Object.fromEntries(
        Object.keys(legacy.scores.categories).map((key) => [key, structuredClone(available)]),
      ),
      contributions: [],
    },
  };
}

describe("FR-020 FR-021 report version compatibility", () => {
  it("rejects counts that disagree with referenced checks and security failures without severity", () => {
    const report = reportV2();
    report.scores.overall.checkCounts.passed = 1;
    expect(AnalysisReportSchema.safeParse(report).success).toBe(false);
    expect(
      InspectionCheckDetailsSchema.safeParse({
        kind: "inspection_check",
        key: "advisories",
        packagePath: ".",
        category: "security",
        state: "fail",
        limitationIds: [],
      }).success,
    ).toBe(false);
  });
  it("requires an explanation for unknown checks", () => {
    expect(
      InspectionCheckDetailsSchema.safeParse({
        kind: "inspection_check",
        key: "test-command",
        packagePath: ".",
        category: "testing",
        state: "unknown",
        limitationIds: [],
      }).success,
    ).toBe(false);
  });
  it("round trips historical reports without changing their scores", () => {
    const report = createValidAnalysisReport();
    expect(AnalysisReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(report);
    expect(AnalysisReportV2Schema.safeParse(report).success).toBe(false);
  });
  it("accepts v2 without the legacy evidenceCoverage field", () => {
    expect(AnalysisReportSchema.safeParse(reportV2()).success).toBe(true);
    expect(AnalysisReportV1Schema.safeParse(reportV2()).success).toBe(false);
  });
  it("rejects unknown versions, legacy coverage fields, and unknown check references", () => {
    expect(AnalysisReportSchema.safeParse({ ...reportV2(), schemaVersion: "3.0.0" }).success).toBe(
      false,
    );
    const report = reportV2();
    report.scores.overall.checkFactIds.push("missing-check");
    expect(AnalysisReportSchema.safeParse(report).success).toBe(false);
    expect(
      AnalysisReportSchema.safeParse({
        ...reportV2(),
        scores: {
          ...reportV2().scores,
          overall: { ...reportV2().scores.overall, evidenceCoverage: 100 },
        },
      }).success,
    ).toBe(false);
  });
  it("does not allow a numeric score with unknown required checks", () => {
    const report = reportV2();
    report.scores.overall.checkCounts.unknown = 1;
    expect(AnalysisReportSchema.safeParse(report).success).toBe(false);
  });
  it("keeps not-applicable, insufficient evidence and zero structurally distinct", () => {
    const report = reportV2();
    const { value: _value, contributionIds: _ids, ...base } = report.scores.overall;
    const scores = [
      { ...base, status: "not_applicable" },
      { ...base, status: "insufficient_evidence", limitationIds: [report.limitations[0]!.id] },
      { ...report.scores.overall, value: 0 },
    ];
    for (const overall of scores)
      expect(
        AnalysisReportSchema.safeParse({ ...report, scores: { ...report.scores, overall } })
          .success,
      ).toBe(true);
  });
  it("rejects v2 additions in the strict historical schema", () => {
    const report = createValidAnalysisReport();
    expect(
      AnalysisReportSchema.safeParse({
        ...report,
        limitations: report.limitations.map((limitation) => ({
          ...limitation,
          reasonCode: "new-reason",
        })),
      }).success,
    ).toBe(false);
    expect(
      AnalysisReportSchema.safeParse({
        ...report,
        findings: report.findings.map((finding) => ({
          ...finding,
          disposition: "issue",
          packagePath: ".",
        })),
      }).success,
    ).toBe(false);
  });
});
