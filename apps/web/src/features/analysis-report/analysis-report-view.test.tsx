import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";

import { createRepositoryReportFixture } from "../repository-analysis/test-fixture.js";
import { AnalysisReportView } from "./analysis-report-view.js";

function manifestReport(): AnalysisReport {
  const report = createRepositoryReportFixture();

  const insufficientScore = {
    status: "insufficient_evidence" as const,
    evidenceCoverage: 0,
    limitationIds: ["limitation-coverage"],
  };

  return {
    ...report,
    input: {
      type: "manifest",
      fingerprint: "fnv1a64:1a:0123456789abcdef",
    },
    facts: [
      {
        id: "fact-expo-dependency",
        type: "dependency.inventory",
        subject: {
          type: "dependency",
          name: "expo",
          path: "package.json",
        },
        statement: "expo is declared in dependencies.",
        details: {
          kind: "dependency_inventory",
          dependencyGroup: "dependencies",
          declaredSpecifier: "~57.0.23",
        },
        rule: {
          id: "JS-DEP-005",
          version: "1",
        },
        requirementIds: ["FR-005"],
        evidenceIds: ["evidence-manifest"],
      },
      {
        id: "fact-biome-dependency",
        type: "dependency.inventory",
        subject: {
          type: "dependency",
          name: "@biomejs/biome",
          path: "package.json",
        },
        statement: "@biomejs/biome is declared in devDependencies.",
        details: {
          kind: "dependency_inventory",
          dependencyGroup: "devDependencies",
          declaredSpecifier: "2.5.13",
        },
        rule: {
          id: "JS-DEP-005",
          version: "1",
        },
        requirementIds: ["FR-005"],
        evidenceIds: ["evidence-manifest"],
      },
      {
        id: "fact-eslint-dependency",
        type: "dependency.inventory",
        subject: {
          type: "dependency",
          name: "eslint",
          path: "package.json",
        },
        statement: "eslint is declared in devDependencies.",
        details: {
          kind: "dependency_inventory",
          dependencyGroup: "devDependencies",
          declaredSpecifier: "10.10.0",
        },
        rule: {
          id: "JS-DEP-005",
          version: "1",
        },
        requirementIds: ["FR-005"],
        evidenceIds: ["evidence-manifest"],
      },
      {
        id: "fact-expo-tool",
        type: "project.tool.framework",
        subject: {
          type: "tool",
          name: "Expo",
          path: "package.json",
        },
        statement: "Detected Expo as a supported application framework.",
        rule: {
          id: "JS-TOOL-012",
          version: "1",
        },
        requirementIds: ["FR-012"],
        evidenceIds: ["evidence-manifest"],
      },
      {
        id: "fact-biome-tool",
        type: "project.tool.linter_formatter",
        subject: {
          type: "tool",
          name: "Biome",
          path: "package.json",
        },
        statement: "Detected Biome as a supported linter/formatter.",
        rule: {
          id: "JS-TOOL-012",
          version: "1",
        },
        requirementIds: ["FR-012"],
        evidenceIds: ["evidence-manifest"],
      },
      {
        id: "fact-eslint-tool",
        type: "project.tool.linter",
        subject: {
          type: "tool",
          name: "ESLint",
          path: "package.json",
        },
        statement: "Detected ESLint as a supported linter.",
        rule: {
          id: "JS-TOOL-012",
          version: "1",
        },
        requirementIds: ["FR-012"],
        evidenceIds: ["evidence-manifest"],
      },
    ],
    findings: [],
    recommendations: [],
    scores: {
      overall: { ...insufficientScore },
      categories: {
        dependencies: { ...insufficientScore },
        security: { ...insufficientScore },
        maintainability: { ...insufficientScore },
        testing: { ...insufficientScore },
        tooling: { ...insufficientScore },
      },
      contributions: [],
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
    expect(screen.getByText("Manifest insights")).toBeInTheDocument();
    expect(screen.getByText("Verified from package.json")).toBeInTheDocument();
    expect(screen.getByText("Declared dependency entries")).toBeInTheDocument();
    expect(screen.getByText("Supported frameworks and tools detected")).toBeInTheDocument();
    expect(screen.getByText("Expo")).toBeInTheDocument();
    expect(screen.getByText("Biome")).toBeInTheDocument();
    expect(screen.getByText("ESLint")).toBeInTheDocument();
    expect(screen.getByText("View declared dependencies (3)")).toBeInTheDocument();
    expect(
      screen.getByText(/percentage measures evidence available to the numeric scoring policy/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);
  });
});
