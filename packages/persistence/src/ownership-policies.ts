// PostgreSQL's canonical expression text is checked as well as policy identity and applicability.
// An equivalent but unrecognized definition fails closed until the owned migration reconciles it.
const ownerExpression =
  "((owner_github_id IS NULL) OR (owner_github_id = NULLIF(current_setting('stacklens.owner_github_id'::text, true), ''::text)))";
const reportExpression =
  "(EXISTS ( SELECT 1 FROM analysis WHERE (analysis.id = analysis_report.analysis_id)))";
const deliveryExpression =
  "(EXISTS ( SELECT 1 FROM analysis WHERE (analysis.id = analysis_delivery.analysis_id)))";

const expectedPolicies = [
  {
    table: "analysis",
    name: "analysis_owner_read",
    command: "r",
    using: ownerExpression,
    check: null,
  },
  {
    table: "analysis",
    name: "analysis_owner_create",
    command: "a",
    using: null,
    check: ownerExpression,
  },
  {
    table: "analysis_report",
    name: "report_owner_read",
    command: "r",
    using: reportExpression,
    check: null,
  },
  {
    table: "analysis_delivery",
    name: "delivery_owner_read",
    command: "r",
    using: deliveryExpression,
    check: null,
  },
  {
    table: "analysis_delivery",
    name: "delivery_owner_create",
    command: "a",
    using: null,
    check: deliveryExpression,
  },
] as const;

function expressionMatches(value: unknown, expected: string | null): boolean {
  return expected === null
    ? value === null
    : typeof value === "string" && value.replace(/\s+/gu, " ").trim() === expected;
}

export function ownershipPoliciesValid(rows: readonly Record<string, unknown>[]): boolean {
  return (
    rows.length === expectedPolicies.length &&
    expectedPolicies.every((expected) => {
      const row = rows.find(
        (candidate) => candidate.table === expected.table && candidate.name === expected.name,
      );
      return (
        row !== undefined &&
        row.command === expected.command &&
        row.permissive === true &&
        Array.isArray(row.roles) &&
        row.roles.length === 1 &&
        row.roles[0] === 0 &&
        expressionMatches(row.using, expected.using) &&
        expressionMatches(row.check, expected.check)
      );
    })
  );
}
