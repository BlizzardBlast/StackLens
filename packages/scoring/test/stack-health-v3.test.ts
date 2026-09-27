import { describe, expect, it } from "vitest";

import { AnalysisScoresV2Schema } from "@stacklens/contracts";
import type {
  AnalysisFact,
  Finding,
  InspectionCheckDetails,
  RiskBand,
  ScoreCategory,
} from "@stacklens/contracts";

import { stackHealthScorer } from "../src/index.js";

const categories = ["dependencies", "security", "maintainability", "testing", "tooling"] as const;
function check(
  category: ScoreCategory,
  state: InspectionCheckDetails["state"] = "pass",
  index = 0,
  band: RiskBand = "none",
): AnalysisFact {
  const id = category + "-" + index;
  return {
    id,
    type: "project.inspection.check",
    subject: { type: "project_setup", name: id },
    statement: "Fixture inspection check.",
    details: {
      kind: "inspection_check",
      key: id,
      category,
      packagePath: ".",
      state,
      observedSeverity: band,
      packageName: "package-" + index,
      limitationIds: state === "unknown" ? ["unknown-" + id] : [],
    },
    rule: { id: "JS-INSPECTION-018", version: "1" },
    requirementIds: ["FR-019"],
    evidenceIds: ["evidence-" + id],
  };
}
function score(facts = categories.map((category) => check(category)), findings: Finding[] = []) {
  const result = stackHealthScorer.score({
    facts,
    findings,
    evidence: [],
    sources: [],
    limitations: [],
    partialFailures: [],
  });
  return AnalysisScoresV2Schema.parse(result);
}
function advice(index: number): Finding {
  return {
    id: "update-" + index,
    category: "dependencies",
    classification: "fact",
    subject: { type: "dependency", name: "package-" + index },
    title: "Update available",
    description: "A newer version exists.",
    rule: { id: "JS-NPM-006", version: "2" },
    requirementIds: ["FR-006"],
    factIds: [],
    evidenceIds: ["evidence-dependencies-0"],
    limitationIds: [],
    priority: {
      level: "critical",
      rule: { id: "PRIORITY", version: "1" },
      rationale: "Even an incorrectly high priority cannot define score impact.",
      factors: [
        { key: "test", rationale: "Test priority", evidenceIds: ["evidence-dependencies-0"] },
      ],
    },
  };
}
describe("stack-health-v3 [SCORE-001 SCORE-002 SCORE-003 FR-018 FR-019 FR-020]", () => {
  it("gives 25 update notices and major migration advice zero score impact", () => {
    const notices = Array.from({ length: 25 }, (_, i) => advice(i));
    const migration = {
      ...advice(26),
      category: "maintainability" as const,
      rule: { id: "JS-MIGRATION-014", version: "1" },
    };
    expect(score(undefined, [...notices, migration])).toEqual(score());
  });
  it("uses one medium deprecation band for one or twenty affected packages", () => {
    for (const count of [1, 20]) {
      const result = score([
        ...categories
          .filter((category) => category !== "dependencies")
          .map((category) => check(category)),
        ...Array.from({ length: count }, (_, i) => check("dependencies", "fail", i)),
      ]);
      expect(result.categories.dependencies).toMatchObject({
        status: "available",
        value: 70,
        band: "medium",
        affectedPackageCount: count,
      });
      expect(result.overall).toMatchObject({ status: "available", value: 70 });
    }
  });
  it("weights applicable readiness checks equally and omits not-applicable checks", () => {
    const result = score([
      ...categories.filter((category) => category !== "testing").map((category) => check(category)),
      check("testing", "pass", 0),
      check("testing", "fail", 1),
      check("testing", "not_applicable", 2),
    ]);
    expect(result.categories.testing).toMatchObject({
      status: "available",
      value: 50,
      checkCounts: { passed: 1, failed: 1, unknown: 0, notApplicable: 1 },
    });
  });
  it("keeps unknown, zero and not-applicable distinct", () => {
    const unknown = score(
      categories.map((category) => check(category, category === "testing" ? "unknown" : "pass")),
    );
    expect(unknown.categories.testing.status).toBe("insufficient_evidence");
    expect(unknown.overall.status).toBe("insufficient_evidence");
    expect(
      score(categories.map((category) => check(category, "not_applicable"))).overall.status,
    ).toBe("not_applicable");
    const zero = score(
      categories.map((category) =>
        check(category, category === "security" ? "fail" : "pass", 0, "critical"),
      ),
    );
    expect(zero.overall).toMatchObject({ status: "available", value: 0 });
  });
  it("never improves the score with stronger severity and enforces the risk ceiling", () => {
    const values = (["none", "low", "medium", "high", "critical"] as const).map((band) => {
      const result = score(
        categories.map((category) =>
          check(
            category,
            category === "security" ? "fail" : "pass",
            0,
            category === "security" ? band : "none",
          ),
        ),
      );
      expect(result.overall.status).toBe("available");
      return result.overall.status === "available" ? result.overall.value : -1;
    });
    expect(values).toEqual([100, 90, 70, 40, 0]);
  });
  it("ignores priority and preserves deterministic ordering", () => {
    const facts = categories.map((category) => check(category));
    expect(score(facts)).toEqual(score([...facts].toReversed()));
  });
});
