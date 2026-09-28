import * as importedCvssCalculator from "ae-cvss-calculator";

import type { AdvisoryDetails } from "@stacklens/contracts";

import type { JavaScriptOsvVulnerability } from "./analysis-metadata.js";

const BASE_METRICS = {
  "2.0": ["AV", "AC", "Au", "C", "I", "A"],
  "3.0": ["AV", "AC", "PR", "UI", "S", "C", "I", "A"],
  "3.1": ["AV", "AC", "PR", "UI", "S", "C", "I", "A"],
  "4.0": ["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"],
} as const;
type Version = keyof typeof BASE_METRICS;

interface CalculatedScores {
  readonly base?: number;
  readonly overall?: number;
}

interface CvssVectorCalculator {
  calculateScores(): CalculatedScores;
}

interface CvssCalculatorConstructor {
  new (vector: string): CvssVectorCalculator;
}

interface CvssCalculatorAdapter {
  readonly Cvss2: CvssCalculatorConstructor;
  readonly Cvss3P0: CvssCalculatorConstructor;
  readonly Cvss3P1: CvssCalculatorConstructor;
  readonly Cvss4P0: CvssCalculatorConstructor;
}

function isCvssCalculatorAdapter(value: unknown): value is CvssCalculatorAdapter {
  return (
    typeof value === "object" &&
    value !== null &&
    "Cvss2" in value &&
    typeof value.Cvss2 === "function" &&
    "Cvss3P0" in value &&
    typeof value.Cvss3P0 === "function" &&
    "Cvss3P1" in value &&
    typeof value.Cvss3P1 === "function" &&
    "Cvss4P0" in value &&
    typeof value.Cvss4P0 === "function"
  );
}

const calculatorCandidate: unknown =
  "default" in importedCvssCalculator ? importedCvssCalculator.default : importedCvssCalculator;

if (!isCvssCalculatorAdapter(calculatorCandidate)) {
  throw new Error("ae-cvss-calculator does not expose the required CVSS constructors.");
}

const calculator = calculatorCandidate;
const { Cvss2, Cvss3P0, Cvss3P1, Cvss4P0 } = calculator;

function baseScore(
  version: Version,
  vector: string,
  raw: string,
  parts: readonly string[],
): number {
  if (version === "4.0") {
    // Constructing the full vector validates Threat/Environmental metrics before they are excluded.
    new Cvss4P0(vector).calculateScores();
    const base =
      "CVSS:4.0/" +
      parts
        .filter((part) => (BASE_METRICS["4.0"] as readonly string[]).includes(part.split(":")[0]!))
        .join("/");
    const score = new Cvss4P0(base).calculateScores().overall;
    if (score === undefined) throw new Error("CVSS 4.0 base score is unavailable");
    return score;
  }

  const score =
    version === "3.1"
      ? new Cvss3P1(vector).calculateScores().base
      : version === "3.0"
        ? new Cvss3P0(vector).calculateScores().base
        : new Cvss2(raw).calculateScores().base;
  if (score === undefined) throw new Error("CVSS base score is unavailable");
  return score;
}

export function normalizeAdvisorySeverity(
  advisories: readonly JavaScriptOsvVulnerability[],
  packageName: string,
): Pick<AdvisoryDetails, "severity" | "ratings"> {
  const ratings: AdvisoryDetails["ratings"] = [];
  for (const advisory of advisories)
    for (const entry of [
      ...advisory.severities,
      ...advisory.affected
        .filter((item) => item.ecosystem === "npm" && item.packageName === packageName)
        .flatMap((item) => item.severities),
    ]) {
      if (entry.score.length > 1000 || (entry.source?.length ?? 0) > 500) continue;
      const vector = entry.score;
      const version: Version | undefined =
        vector.startsWith("CVSS:4.0/") && entry.type === "CVSS_V4"
          ? "4.0"
          : vector.startsWith("CVSS:3.1/") && entry.type === "CVSS_V3"
            ? "3.1"
            : vector.startsWith("CVSS:3.0/") && entry.type === "CVSS_V3"
              ? "3.0"
              : entry.type === "CVSS_V2"
                ? "2.0"
                : undefined;
      if (version === undefined) continue;
      try {
        const raw = vector.replace(/^CVSS:2\.0\//u, "");
        const parts = (version === "2.0" ? raw : vector.split("/").slice(1).join("/")).split("/");
        const keys = parts.map((part) => part.split(":")[0]);
        if (
          new Set(keys).size !== keys.length ||
          BASE_METRICS[version].some((key) => !keys.includes(key))
        )
          continue;
        const score = baseScore(version, vector, raw, parts);
        if (!Number.isFinite(score) || score < 0 || score > 10) continue;
        ratings.push({
          vector,
          version,
          source: entry.source ?? "OSV",
          baseScore: Object.is(score, -0) ? 0 : score,
        });
      } catch {
        /* Unsupported or malformed vectors stay unknown; never guess a severity. */
      }
    }
  const score =
    ratings.length === 0 ? undefined : Math.max(...ratings.map((rating) => rating.baseScore));
  return {
    severity:
      score === undefined
        ? "unknown"
        : score === 0
          ? "none"
          : score < 4
            ? "low"
            : score < 7
              ? "medium"
              : score < 9
                ? "high"
                : "critical",
    ratings: [
      ...new Map(ratings.map((rating) => [JSON.stringify(rating), rating])).values(),
    ].toSorted((a, b) => a.vector.localeCompare(b.vector) || a.source.localeCompare(b.source)),
  };
}

export function advisoryAliasGroup(
  advisories: readonly JavaScriptOsvVulnerability[],
  id: string,
): readonly JavaScriptOsvVulnerability[] {
  const identifiers = new Set([id]);
  const selected = new Set<JavaScriptOsvVulnerability>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of advisories)
      if (
        !selected.has(item) &&
        [item.id, ...(item.aliases ?? [])].some((alias) => identifiers.has(alias))
      ) {
        selected.add(item);
        identifiers.add(item.id);
        for (const alias of item.aliases ?? []) identifiers.add(alias);
        changed = true;
      }
  }
  return [...selected]
    .filter((item) => item.withdrawnAt === undefined)
    .toSorted((a, b) => a.id.localeCompare(b.id));
}
