import { describe, expect, it } from "vitest";

import { AnalysisFactSchema } from "../src/fact.js";

const baseFact = {
  id: "fact-react-dependencies",
  type: "dependency.inventory",
  subject: {
    type: "dependency",
    name: "react",
  },
  statement: 'react is declared in dependencies as "^19.0.0".',
  rule: {
    id: "JS-DEP-005",
    version: "1",
  },
  requirementIds: ["FR-005"],
  evidenceIds: ["evidence-react-dependencies"],
} as const;

describe("AnalysisFactSchema [FR-005]", () => {
  it("accepts structured dependency inventory details without changing generic subject semantics", () => {
    const parsed = AnalysisFactSchema.parse({
      ...baseFact,
      details: {
        kind: "dependency_inventory",
        dependencyGroup: "dependencies",
        declaredSpecifier: "workspace:^ || https://example.com/pkg.tgz",
      },
    });

    expect(parsed.details).toEqual({
      kind: "dependency_inventory",
      dependencyGroup: "dependencies",
      declaredSpecifier: "workspace:^ || https://example.com/pkg.tgz",
    });
  });

  it("keeps existing facts without details valid", () => {
    expect(AnalysisFactSchema.safeParse(baseFact).success).toBe(true);
  });

  it("rejects empty declared dependency specifiers", () => {
    const result = AnalysisFactSchema.safeParse({
      ...baseFact,
      details: {
        kind: "dependency_inventory",
        dependencyGroup: "dependencies",
        declaredSpecifier: "",
      },
    });

    expect(result.success).toBe(false);
  });
});
