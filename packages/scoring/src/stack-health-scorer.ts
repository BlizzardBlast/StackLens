import type { AnalysisScorer, ScoringContext } from "@stacklens/analyzer-core";
import type {
  AnalysisFact,
  AnalysisScoresV2,
  InspectionCheckDetails,
  RiskBand,
  ScoreCategory,
  ScoreExplanation,
  ScoreResultV2,
} from "@stacklens/contracts";

export const STACK_HEALTH_SCORING_VERSION = "stack-health-v3";
const ORDER = ["dependencies", "security", "maintainability", "testing", "tooling"] as const;
const BANDS: Readonly<Record<RiskBand, number>> = {
  none: 100,
  low: 90,
  medium: 70,
  high: 40,
  critical: 0,
};
const SCOPES: Readonly<Record<ScoreCategory, string>> = {
  dependencies: "Explicit npm deprecation of supported exact dependency versions.",
  security:
    "Active exact-version OSV matches with supported CVSS base severity; no reachability or transitive audit.",
  maintainability:
    "Declared static lint and applicable type-check safeguards across workspace packages.",
  testing:
    "Declared test execution paths and matching file presence, not test success or runtime coverage.",
  tooling: "Shared repository package-manager pin and matching workspace lockfile.",
};
type CheckFact = AnalysisFact & { readonly details: InspectionCheckDetails };
function checks(context: ScoringContext, category: ScoreCategory): CheckFact[] {
  return context.facts
    .filter(
      (fact): fact is CheckFact =>
        fact.details?.kind === "inspection_check" && fact.details.category === category,
    )
    .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function counts(facts: readonly CheckFact[]) {
  return {
    passed: facts.filter((fact) => fact.details.state === "pass").length,
    failed: facts.filter((fact) => fact.details.state === "fail").length,
    unknown: facts.filter((fact) => fact.details.state === "unknown").length,
    notApplicable: facts.filter((fact) => fact.details.state === "not_applicable").length,
  };
}
function explanation(
  id: string,
  category: ScoreCategory,
  kind: ScoreExplanation["kind"],
  points: number,
  rationale: string,
  facts: readonly AnalysisFact[],
  findingIds: string[] = [],
): ScoreExplanation {
  return {
    id,
    category,
    kind,
    direction: "deduction",
    points,
    rationale,
    rule: { id: "SCORE-STACK-001", version: "3" },
    factIds: facts.map((fact) => fact.id),
    findingIds,
    evidenceIds: [...new Set(facts.flatMap((fact) => fact.evidenceIds))],
  };
}
export const stackHealthScorer: AnalysisScorer = {
  version: STACK_HEALTH_SCORING_VERSION,
  score(context): AnalysisScoresV2 {
    const contributions: ScoreExplanation[] = [];
    function categoryScore(category: ScoreCategory): ScoreResultV2 {
      const facts = checks(context, category);
      const checkCounts = counts(facts);
      const base = {
        scope: SCOPES[category],
        checkCounts,
        checkFactIds: facts.map((fact) => fact.id),
      };
      const unknownLimitations = facts.flatMap((fact) =>
        fact.details.state === "unknown" ? fact.details.limitationIds : [],
      );
      const failedRules = context.limitations.filter(
        (item) => item.kind === "partial_failure" && item.ruleIds.includes("JS-INSPECTION-018"),
      );
      if (checkCounts.unknown > 0 || facts.length === 0 || failedRules.length > 0) {
        const limitationIds = [
          ...new Set([
            ...unknownLimitations,
            ...failedRules.map((item) => item.id),
            ...(facts.length === 0
              ? context.limitations
                  .filter(
                    (item) =>
                      item.affectedCategories.includes(category) || item.kind === "partial_failure",
                  )
                  .map((item) => item.id)
              : []),
          ]),
        ].toSorted();
        if (limitationIds.length === 0)
          throw new Error("Missing inspection checks require explicit limitations.");
        return {
          ...base,
          status: "insufficient_evidence",
          rationale:
            "Required inspection checks remain unknown; they are neither passes nor failures.",
          limitationIds,
        };
      }
      const applicable = facts.filter((fact) => fact.details.state !== "not_applicable");
      if (applicable.length === 0)
        return {
          ...base,
          status: "not_applicable",
          rationale: "No checks apply in the inspected category scope.",
        };
      if (category === "dependencies" || category === "security") {
        const failed = applicable.filter((fact) => fact.details.state === "fail");
        let band: RiskBand = category === "dependencies" && failed.length > 0 ? "medium" : "none";
        if (category === "security")
          for (const fact of applicable) {
            const severity = fact.details.observedSeverity;
            if (severity !== undefined && BANDS[severity] < BANDS[band]) band = severity;
          }
        const findings = context.findings.filter(
          (finding) =>
            finding.category === category &&
            finding.classification === "fact" &&
            (category === "dependencies"
              ? finding.rule.id === "JS-NPM-007"
              : finding.rule.id === "JS-VULN-011"),
        );
        const id = "score-v3-" + category + "-band";
        const affectedPackageCount = new Set(
          failed.flatMap((fact) =>
            fact.details.packageName === undefined ? [] : [fact.details.packageName],
          ),
        ).size;
        const groups: Set<string>[] = [];
        for (const finding of findings)
          if (finding.details?.kind === "advisory") {
            const ids = [finding.details.advisoryId, ...finding.details.aliases];
            const group = new Set(ids);
            for (let i = groups.length - 1; i >= 0; i -= 1)
              if ([...groups[i]!].some((alias) => group.has(alias))) {
                for (const alias of groups[i]!) group.add(alias);
                groups.splice(i, 1);
              }
            groups.push(group);
          }
        const affectedAdvisoryCount = groups.length;
        const rationale =
          "The worst supported " +
          band +
          " band selects " +
          BANDS[band] +
          ". Repeated causes in the same band change affected counts, not this score. These are product bands, not percentages of safety.";
        contributions.push(
          explanation(
            id,
            category,
            "risk_band",
            100 - BANDS[band],
            rationale,
            applicable,
            findings.map((finding) => finding.id),
          ),
        );
        return {
          ...base,
          checkCounts: { ...checkCounts, unknown: 0 },
          status: "available",
          value: BANDS[band],
          band,
          rationale,
          affectedPackageCount,
          ...(category === "security" ? { affectedAdvisoryCount } : {}),
          contributionIds: [id],
        };
      }
      const weight = 100 / applicable.length;
      const value = (100 * checkCounts.passed) / applicable.length;
      const ids: string[] = [];
      for (const fact of applicable) {
        const id = "score-v3-" + fact.id;
        ids.push(id);
        contributions.push(
          explanation(
            id,
            category,
            "readiness_check",
            fact.details.state === "pass" ? 0 : weight,
            "Check " +
              fact.details.key +
              " at " +
              fact.details.packagePath +
              " is " +
              fact.details.state +
              "; each applicable check has equal weight (" +
              weight +
              " points).",
            [fact],
          ),
        );
      }
      return {
        ...base,
        checkCounts: { ...checkCounts, unknown: 0 },
        status: "available",
        value,
        rationale:
          checkCounts.passed +
          " of " +
          applicable.length +
          " applicable checks passed. Unknown checks cannot receive a numeric score.",
        contributionIds: ids,
      };
    }
    const categories = {
      dependencies: categoryScore("dependencies"),
      security: categoryScore("security"),
      maintainability: categoryScore("maintainability"),
      testing: categoryScore("testing"),
      tooling: categoryScore("tooling"),
    };
    const allChecks = ORDER.flatMap((category) => checks(context, category));
    const checkCounts = counts(allChecks);
    const base = {
      scope: "Mean applicable categories, capped by applicable Dependencies and Security scores.",
      checkCounts,
      checkFactIds: allChecks.map((fact) => fact.id),
    };
    const unknowns = ORDER.flatMap((category) =>
      categories[category].status === "insufficient_evidence" ? [categories[category]] : [],
    );
    let overall: ScoreResultV2;
    if (unknowns.length > 0)
      overall = {
        ...base,
        status: "insufficient_evidence",
        rationale: "A required category is unknown. Overall scoring remains unavailable.",
        limitationIds: [
          ...new Set(
            unknowns.flatMap((score) =>
              score.status === "insufficient_evidence" ? score.limitationIds : [],
            ),
          ),
        ].toSorted(),
      };
    else {
      const available = ORDER.flatMap((category) =>
        categories[category].status === "available"
          ? [{ category, score: categories[category] }]
          : [],
      );
      if (available.length === 0)
        overall = {
          ...base,
          status: "not_applicable",
          rationale: "No category applies to the inspected scope.",
        };
      else {
        const mean =
          available.reduce(
            (total, item) => total + (item.score.status === "available" ? item.score.value : 0),
            0,
          ) / available.length;
        const ceilings = available.filter(
          (item) => item.category === "dependencies" || item.category === "security",
        );
        const value = Math.min(
          mean,
          ...ceilings.map((item) => (item.score.status === "available" ? item.score.value : 100)),
        );
        const rationale =
          "Overall = min(mean of applicable categories " +
          mean +
          (ceilings.length === 0
            ? ""
            : ", " +
              ceilings
                .map(
                  (item) =>
                    item.category +
                    " " +
                    (item.score.status === "available" ? item.score.value : ""),
                )
                .join(", ")) +
          ") = " +
          value +
          ". Setup scores cannot raise a lower dependency or security band.";
        const id = "score-v3-overall-ceiling";
        contributions.push(
          explanation(
            id,
            ceilings[0]?.category ?? available[0]!.category,
            "overall_ceiling",
            mean - value,
            rationale,
            allChecks,
          ),
        );
        overall = {
          ...base,
          checkCounts: { ...checkCounts, unknown: 0 },
          status: "available",
          value,
          rationale,
          contributionIds: [id],
        };
      }
    }
    return { overall, categories, contributions };
  },
};
