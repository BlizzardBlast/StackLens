import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reportV2Fixture } from "../analysis-report/v2-test-fixture.js";
import { QuickAnalysisApiError, type QuickAnalysisClient } from "./quick-analysis-api.js";
import { QuickAnalysisPage } from "./quick-analysis-page.js";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
afterEach(() => vi.restoreAllMocks());

function setup(client: QuickAnalysisClient) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <QuickAnalysisPage client={client} />
    </QueryClientProvider>,
  );
}
function submit() {
  fireEvent.change(screen.getByLabelText("package.json content"), { target: { value: "{}" } });
  fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));
}

describe("quick completion focus [FR-002, FR-017, FR-021, NFR-006]", () => {
  it("focuses completion once, preserves a stable announcement, and restores the reset heading", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const analyzeManifest = vi
      .fn<QuickAnalysisClient["analyzeManifest"]>()
      .mockResolvedValue(reportV2Fixture());
    const view = setup({ analyzeManifest });
    const introduction = screen.getByRole("heading", { name: "Start with your package.json." });
    const status = screen.getByRole("status");
    expect(introduction).not.toHaveFocus();
    expect(status).toBeEmptyDOMElement();
    submit();
    const reportHeading = await screen.findByRole("heading", { name: "Analysis report" });
    await waitFor(() => expect(reportHeading).toHaveFocus());
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("Quick analysis complete. Report ready.");
    expect(status).toHaveAttribute("aria-live", "polite");
    const reset = screen.getByRole("button", { name: "Analyze another manifest" });
    reset.focus();
    fireEvent.click(screen.getAllByRole("button", { name: /View evidence/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(reportHeading).not.toHaveFocus();
    fireEvent.click(reset);
    expect(screen.getByRole("heading", { name: "Start with your package.json." })).toHaveFocus();
    expect(status).toBeEmptyDOMElement();
    submit();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Analysis report" })).toHaveFocus(),
    );
    expect(analyzeManifest).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("keeps form content and interaction when analysis fails", async () => {
    const analyzeManifest = vi
      .fn<QuickAnalysisClient["analyzeManifest"]>()
      .mockRejectedValue(new QuickAnalysisApiError("invalid_manifest", "Invalid manifest.", 400));
    setup({ analyzeManifest });
    const textarea = screen.getByLabelText("package.json content");
    textarea.focus();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid manifest.");
    expect(textarea).toHaveValue("{}");
    expect(textarea).toHaveFocus();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading", { name: "Analysis report" })).not.toBeInTheDocument();
  });
});
