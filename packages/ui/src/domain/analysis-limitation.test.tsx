import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisLimitation } from "#domain/analysis-limitation";

describe("AnalysisLimitation", () => {
  it("exposes limitations with a non-color text explanation", () => {
    render(
      <AnalysisLimitation title="Testing score is unavailable">
        This does not mean the project has no tests.
      </AnalysisLimitation>
    );

    expect(screen.getByRole("note")).toHaveTextContent("Testing score is unavailable");
    expect(screen.getByRole("note")).toHaveTextContent(
      "This does not mean the project has no tests."
    );
  });
});
