import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { AnalysisStatusView } from "./analysis-status-view.js";
import type { RepositoryAnalysisSnapshot } from "./repository-analysis-api.js";
import { createRepositoryReportFixture } from "./test-fixture.js";

function snapshot(overrides: Partial<RepositoryAnalysisSnapshot> = {}): RepositoryAnalysisSnapshot {
  return {
    analysisId: "analysis-web-001",
    repositoryUrl: "https://github.com/BlizzardBlast/StackLens",
    status: "running",
    progressStage: "collecting_metadata",
    createdAt: "2026-09-21T12:00:00Z",
    updatedAt: "2026-09-21T12:01:00Z",
    ...overrides,
  };
}

function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({
    component: () => <>{ui}</>,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("AnalysisStatusView [FR-017, FR-021, NFR-006, NFR-008]", () => {
  it("shows the actual coarse progress stage without inventing percentage progress", () => {
    renderWithRouter(<AnalysisStatusView snapshot={snapshot()} />);

    expect(screen.getByText("Collecting package metadata")).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it("renders terminal failure distinctly from a limited successful report", () => {
    renderWithRouter(
      <AnalysisStatusView
        snapshot={snapshot({
          status: "failed",
          progressStage: "failed",
          failure: {
            code: "repository_unavailable",
            message: "The repository could not be resolved.",
            retryable: false,
          },
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Analysis failed");
    expect(screen.getByRole("alert")).toHaveTextContent("The repository could not be resolved.");
  });

  it("renders a completed-with-limitations report and evidence from contract data", () => {
    const report = createRepositoryReportFixture();

    renderWithRouter(
      <AnalysisStatusView
        snapshot={snapshot({
          status: "completed_with_limitations",
          progressStage: "completed_with_limitations",
          report,
        })}
      />,
    );

    expect(screen.getByText("Analysis completed with limitations")).toBeInTheDocument();
    expect(screen.getByText("Example evidence-backed finding")).toBeInTheDocument();
    expect(screen.getAllByText("N/A").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /View evidence/ }));

    expect(screen.getByText("example-package is declared in package.json.")).toBeInTheDocument();
    expect(screen.getByText(/JS-EXAMPLE-001/)).toBeInTheDocument();
  });
});
