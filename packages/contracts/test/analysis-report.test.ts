import { describe, expect, it } from "vitest";

import { AnalysisReportSchema } from "../src/analysis-report.js";

import { createValidAnalysisReport } from "./fixture.js";

describe("AnalysisReportSchema", () => {
  it("accepts a valid report with facts, findings, recommendations, scores and limitations", () => {
    const result = AnalysisReportSchema.safeParse(createValidAnalysisReport());

    expect(result.success).toBe(true);
  });

  it("treats an available zero score differently from insufficient evidence", () => {
    const report = createValidAnalysisReport();
    report.scores.overall = {
      status: "available",
      value: 0,
      evidenceCoverage: 80,
      contributionIds: ["score-contribution-deprecation"]
    };

    expect(AnalysisReportSchema.safeParse(report).success).toBe(true);
  });

  it("rejects an unresolved external evidence source", () => {
    const report = createValidAnalysisReport();
    const evidence = report.evidence.find((item) => item.kind === "external");

    if (evidence?.kind === "external") {
      evidence.sourceId = "missing-source";
    }

    const result = AnalysisReportSchema.safeParse(report);

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.message.includes("Unknown source reference"))).toBe(
      true
    );
  });

  it("rejects external evidence from a source marked unavailable", () => {
    const report = createValidAnalysisReport();
    report.sources[0] = {
      id: "source-npm",
      provider: "npm",
      status: "unavailable",
      attemptedAt: "2026-09-19T02:00:00Z",
      reference: "legacy-tool"
    };

    const result = AnalysisReportSchema.safeParse(report);

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) =>
        issue.message.includes("External evidence cannot reference unavailable source")
      )
    ).toBe(true);
  });

  it("rejects unresolved recommendation finding references", () => {
    const report = createValidAnalysisReport();
    report.recommendations[0]!.findingIds = ["missing-finding"];

    const result = AnalysisReportSchema.safeParse(report);

    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((issue) => issue.message.includes("Unknown finding reference"))
    ).toBe(true);
  });

  it("rejects duplicate entity ids within a report collection", () => {
    const report = createValidAnalysisReport();
    report.evidence.push({ ...report.evidence[0]! });

    const result = AnalysisReportSchema.safeParse(report);

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.message.includes("Duplicate evidence id"))).toBe(
      true
    );
  });
});
