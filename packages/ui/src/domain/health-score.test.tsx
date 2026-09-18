import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HealthScore } from "#domain/health-score";

describe("HealthScore", () => {
  it("renders a known score together with evidence coverage", () => {
    render(
      <HealthScore
        score={82}
        state="good"
        coveragePercent={84}
        detail="Evidence is available for four of five categories."
      />
    );

    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /evidence coverage/i })).toHaveAttribute(
      "value",
      "84"
    );
  });

  it("renders N/A explicitly when score evidence is insufficient", () => {
    render(
      <HealthScore
        score={null}
        state="unknown"
        coveragePercent={0}
        detail="Insufficient evidence to calculate this category."
      />
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
  });
});
