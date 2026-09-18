import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "#components/button";

describe("Button", () => {
  it("preserves accessible native button semantics", () => {
    render(<Button>Analyze repository</Button>);

    expect(screen.getByRole("button", { name: "Analyze repository" })).toBeEnabled();
  });

  it("exposes disabled state", () => {
    render(<Button disabled>Analyzing</Button>);

    expect(screen.getByRole("button", { name: "Analyzing" })).toBeDisabled();
  });
});
