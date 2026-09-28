import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { QuickManifestAnalysisInput } from "./quick-analysis-api.js";
import { QuickAnalysisForm } from "./quick-analysis-form.js";

describe("QuickAnalysisForm [FR-001, FR-002, FR-004, FR-022, NFR-006, NFR-007]", () => {
  it("keeps explicit spacing between the input legend and mode choices", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    expect(screen.getByText("Choose your input")).toHaveClass("mb-3");
  });

  it("submits pasted manifest content without duplicating authoritative JSON validation", async () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("package.json content"), {
      target: { value: '{"name":"demo","dependencies":{"react":"^19.0.0"}}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "paste",
        content: '{"name":"demo","dependencies":{"react":"^19.0.0"}}',
      });
    });
  });

  it("reads a selected package.json locally and submits the JSON upload shape", async () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    const file = new File(['{"name":"demo"}'], "package.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve('{"name":"demo"}'),
    });

    fireEvent.change(screen.getByLabelText("Local package.json"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("package.json")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "upload",
        filename: "package.json",
        content: '{"name":"demo"}',
      });
    });
  });

  it("preserves pasted content when Fastify returns an authoritative validation error", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { rerender } = render(<QuickAnalysisForm onSubmit={onSubmit} />);
    const textarea = screen.getByLabelText("package.json content");

    fireEvent.change(textarea, {
      target: { value: '{"name": }' },
    });

    rerender(
      <QuickAnalysisForm onSubmit={onSubmit} serverError="package.json must contain valid JSON." />,
    );

    expect(textarea).toHaveValue('{"name": }');
    expect(screen.getByRole("alert")).toHaveTextContent("package.json must contain valid JSON.");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "manifest-content-help quick-analysis-error",
    );
    expect(textarea).toHaveAccessibleDescription(
      "StackLens inspects the manifest without running scripts or installing dependencies. package.json must contain valid JSON.",
    );
  });

  it("keeps paste help associated when a client validation error appears", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    const textarea = screen.getByLabelText("package.json content");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "manifest-content-help quick-analysis-error",
    );
    expect(textarea).toHaveAccessibleDescription(
      "StackLens inspects the manifest without running scripts or installing dependencies. Paste package.json content before running quick analysis.",
    );
  });

  it("keeps file help associated during client and server errors", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { rerender } = render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    const fileInput = screen.getByLabelText("Local package.json");
    expect(fileInput).toHaveAttribute(
      "aria-describedby",
      "manifest-file-help quick-analysis-error",
    );
    expect(fileInput).toHaveAccessibleDescription(
      "Choose a JSON file named package.json. Choose a package.json file before running quick analysis.",
    );

    fireEvent.change(fileInput, { target: { files: [] } });

    rerender(
      <QuickAnalysisForm onSubmit={onSubmit} serverError="package.json must contain valid JSON." />,
    );

    expect(fileInput).toHaveAttribute(
      "aria-describedby",
      "manifest-file-help quick-analysis-error",
    );
    expect(fileInput).toHaveAccessibleDescription(
      "Choose a JSON file named package.json. package.json must contain valid JSON.",
    );
  });

  it("exposes a synchronous accessible busy state without fake progress", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} isPending />);

    expect(screen.getByLabelText("package.json content")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyzing manifest" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing package.json");
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analyzing manifest" }).closest("form"),
    ).toHaveAttribute("aria-busy", "true");
  });
});
