import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RepositoryAnalysisForm } from "./repository-analysis-form.js";

describe("RepositoryAnalysisForm [FR-003, FR-004, NFR-006, NFR-008]", () => {
  it("rejects an obviously invalid non-HTTPS URL before submission", () => {
    const onSubmit = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    render(<RepositoryAnalysisForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Public GitHub repository"), {
      target: { value: "http://github.com/owner/repository" },
    });
    const form = screen.getByRole("button", { name: "Analyze repository" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(screen.getByRole("alert")).toHaveTextContent("Use an HTTPS repository URL.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves the user's value when the authoritative server returns an error", () => {
    const onSubmit = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const { rerender } = render(<RepositoryAnalysisForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Public GitHub repository");

    fireEvent.change(input, {
      target: { value: "https://example.com/repository" },
    });

    rerender(
      <RepositoryAnalysisForm
        onSubmit={onSubmit}
        serverError="Enter a supported public GitHub repository URL."
      />,
    );

    expect(input).toHaveValue("https://example.com/repository");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a supported public GitHub repository URL.",
    );
  });

  it("exposes an explicit busy state while the analysis is being created", () => {
    const onSubmit = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    render(<RepositoryAnalysisForm onSubmit={onSubmit} isPending />);

    expect(screen.getByLabelText("Public GitHub repository")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Starting analysis" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Creating analysis");
    expect(screen.getByRole("button", { name: "Starting analysis" }).closest("form")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
