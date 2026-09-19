import { describe, expect, it } from "vitest";

import { SourceLocationSchema } from "../src/evidence.js";
import { RequirementIdSchema } from "../src/identifiers.js";

describe("evidence and identifier contracts", () => {
  it("rejects an end line without a start line", () => {
    expect(
      SourceLocationSchema.safeParse({
        path: "package.json",
        endLine: 10
      }).success
    ).toBe(false);
  });

  it("rejects source ranges whose end precedes the start", () => {
    expect(
      SourceLocationSchema.safeParse({
        path: "package.json",
        startLine: 20,
        endLine: 10
      }).success
    ).toBe(false);
  });

  it("accepts StackLens requirement ids and rejects unstructured identifiers", () => {
    expect(RequirementIdSchema.safeParse("FR-017").success).toBe(true);
    expect(RequirementIdSchema.safeParse("some requirement").success).toBe(false);
  });
});
