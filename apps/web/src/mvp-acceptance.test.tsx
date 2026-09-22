import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisReport } from "@stacklens/contracts";

import {
  quickAnalysisClient,
  type QuickManifestAnalysisInput,
} from "./features/quick-analysis/quick-analysis-api.js";
import {
  repositoryAnalysisClient,
  type RepositoryAnalysisSnapshot,
} from "./features/repository-analysis/repository-analysis-api.js";
import { createRepositoryReportFixture } from "./features/repository-analysis/test-fixture.js";
import { router } from "./router.js";

function createManifestReportFixture(): AnalysisReport {
  const report = createRepositoryReportFixture();

  return {
    ...report,
    analysisId: "analysis-quick-acceptance",
    input: {
      type: "manifest",
      fingerprint: "fnv1a64:acceptance",
    },
  };
}

function createCompletedRepositorySnapshot(
  report: AnalysisReport,
): RepositoryAnalysisSnapshot {
  return {
    analysisId: report.analysisId,
    repositoryUrl: "https://github.com/BlizzardBlast/StackLens",
    status: "completed_with_limitations",
    progressStage: "completed_with_limitations",
    createdAt: report.createdAt,
    updatedAt: report.createdAt,
    completedAt: report.createdAt,
    report,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe(
  "MVP production-router acceptance [FR-001, FR-002, FR-003, FR-017, FR-021, FR-022, NFR-006, NFR-007, NFR-008]",
  () => {
    it("traverses quick analysis and repository analysis through their production routes", async () => {
      const quickReport = createManifestReportFixture();
      const repositoryReport = createRepositoryReportFixture();
      const quickSpy = vi
        .spyOn(quickAnalysisClient, "analyzeManifest")
        .mockImplementation(async (_input: QuickManifestAnalysisInput) => quickReport);
      const submitSpy = vi
        .spyOn(repositoryAnalysisClient, "submitRepository")
        .mockResolvedValue({ analysisId: repositoryReport.analysisId });
      const statusSpy = vi
        .spyOn(repositoryAnalysisClient, "getAnalysis")
        .mockResolvedValue(createCompletedRepositorySnapshot(repositoryReport));
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
          mutations: {
            retry: false,
          },
        },
      });

      await router.navigate({ to: "/" });

      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      fireEvent.click(await screen.findByRole("link", { name: /package\.json/i }));

      expect(
        await screen.findByRole("heading", {
          name: "Inspect a package.json without handing over a repository.",
        }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/quick");

      const manifestContent = JSON.stringify({
        name: "acceptance-quick",
        dependencies: {
          react: "19.3.0",
        },
      });

      fireEvent.change(screen.getByLabelText("package.json content"), {
        target: { value: manifestContent },
      });
      fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

      expect(await screen.findByText("Manifest-only analysis")).toBeInTheDocument();
      expect(screen.getByText(/N\/A means insufficient evidence/)).toBeInTheDocument();
      expect(quickSpy).toHaveBeenCalledWith({
        kind: "paste",
        content: manifestContent,
      });

      fireEvent.click(screen.getByRole("link", { name: "StackLens" }));

      expect(
        await screen.findByRole("heading", {
          name: "Understand what is actually happening in your development stack.",
        }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/");

      fireEvent.change(screen.getByLabelText("Public GitHub repository"), {
        target: { value: "https://github.com/BlizzardBlast/StackLens" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Analyze repository" }));

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(
          `/analyses/${repositoryReport.analysisId}`,
        );
      });

      expect(await screen.findByRole("heading", { name: "Analysis report" })).toBeInTheDocument();
      expect(screen.getByText("BlizzardBlast/StackLens")).toBeInTheDocument();
      expect(submitSpy).toHaveBeenCalledWith(
        "https://github.com/BlizzardBlast/StackLens",
      );
      expect(statusSpy).toHaveBeenCalledWith(
        repositoryReport.analysisId,
        expect.any(AbortSignal),
      );
    });
  },
);
