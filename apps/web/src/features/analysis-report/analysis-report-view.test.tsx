import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";

import { createRepositoryReportFixture } from "../repository-analysis/test-fixture.js";
import { AnalysisReportView } from "./analysis-report-view.js";

function manifestReport(): AnalysisReport {
  const report = createRepositoryReportFixture();

  return {
    ...report,
    input: {
      type: "manifest",
      fingerprint: "fnv1a64:1a:0123456789abcdef",
    },
  };
}

describe("AnalysisReportView [FR-017, FR-021, SCORE-003, NFR-006, NFR-007]", () => {
  it("makes the manifest evidence boundary explicit instead of presenting N/A as healthy", () => {
    render(<AnalysisReportView report={manifestReport()} completedWithLimitations />);

    expect(screen.getByText("Manifest-only analysis")).toBeInTheDocument();
    expect(
      screen.getByText(/N\/A means insufficient evidence—not a clean bill of health/),
    ).toBeInTheDocument();
    expect(screen.getByText("Analysis completed with limitations")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
  });
});
