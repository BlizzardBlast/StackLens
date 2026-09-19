import { describe, expect, it } from "vitest";

import type { AnalysisFact } from "@stacklens/contracts";

import { validateFactRuleResult, validateFindingRuleResult } from "../src/rules.js";
import {
  createFact,
  createFindingCandidate,
  createLimitation,
  createPriority,
} from "./fixture.js";

describe("rule output validation", () => {
  it("rejects requirements that the rule did not declare", () => {
    const rule = {
      id: "FACT-A",
      version: "1",
      requirementIds: ["FR-005"] as const,
    };

    const fact: AnalysisFact = {
      ...createFact("FACT-A", "fact-a"),
      requirementIds: ["FR-017"],
    };

    expect(() =>
      validateFactRuleResult(rule, {
        facts: [fact],
      }),
    ).toThrowError(/undeclared requirement FR-017/);
  });

  it("requires rule-created limitations to identify the emitting rule", () => {
    const rule = {
      id: "FINDING-A",
      version: "1",
      requirementIds: ["FR-017"] as const,
    };

    const limitation = {
      ...createLimitation("OTHER-RULE", "limitation-a"),
    };

    expect(() =>
      validateFindingRuleResult(rule, {
        findings: [createFindingCandidate("FINDING-A", "finding-a", "fact-a")],
        limitations: [limitation],
      }),
    ).toThrowError(/without referencing itself/);
  });

  it("rejects a finding rule that attempts to embed its own priority", () => {
    const rule = {
      id: "FINDING-A",
      version: "1",
      requirementIds: ["FR-017"] as const,
    };
    const candidateWithPriority = {
      ...createFindingCandidate("FINDING-A", "finding-a", "fact-a"),
      priority: createPriority(),
    };

    expect(() =>
      validateFindingRuleResult(rule, {
        findings: [candidateWithPriority],
      }),
    ).toThrowError(/schema-invalid factual finding candidate/);
  });
});
