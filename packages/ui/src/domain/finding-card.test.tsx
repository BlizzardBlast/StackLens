import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FindingCard } from "#domain/finding-card";

describe("FindingCard", () => {
  it("renders classification, priority, confidence and evidence action as text semantics", () => {
    const onViewEvidence = vi.fn<() => void>();

    render(
      <FindingCard
        classification="heuristic"
        priority="medium"
        confidence="high"
        subject="legacy-tool"
        title="Package may be unmaintained"
        description="Multiple maintenance signals support this heuristic."
        category="maintainability"
        ruleId="JS-MNT-004"
        onViewEvidence={onViewEvidence}
      />,
    );

    expect(screen.getByText("Heuristic")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByText(/Maintainability · Rule/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view evidence/i })).toBeInTheDocument();
  });
});
