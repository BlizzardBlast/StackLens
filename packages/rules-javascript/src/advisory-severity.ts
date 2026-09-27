import { CVSS20, CVSS30, CVSS31, CVSS40 } from "@pandatix/js-cvss";

import type { AdvisoryDetails } from "@stacklens/contracts";

import type { JavaScriptOsvVulnerability } from "./analysis-metadata.js";

const BASE_METRICS = {
  "2.0": ["AV", "AC", "Au", "C", "I", "A"],
  "3.0": ["AV", "AC", "PR", "UI", "S", "C", "I", "A"],
  "3.1": ["AV", "AC", "PR", "UI", "S", "C", "I", "A"],
  "4.0": ["AV", "AC", "AT", "PR", "UI", "VC", "VI", "VA", "SC", "SI", "SA"],
} as const;
type Version = keyof typeof BASE_METRICS;

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
        let baseScore: number;
        if (version === "4.0") {
          // Validate the full vector, then score Base metrics only (not Threat/Environmental).
          const validated = new CVSS40(vector);
          if (!Number.isFinite(validated.Score())) continue;
          const base =
            "CVSS:4.0/" +
            parts
              .filter((part) =>
                (BASE_METRICS["4.0"] as readonly string[]).includes(part.split(":")[0]!),
              )
              .join("/");
          baseScore = new CVSS40(base).Score();
        } else
          baseScore =
            version === "3.1"
              ? new CVSS31(vector).BaseScore()
              : version === "3.0"
                ? new CVSS30(vector).BaseScore()
                : new CVSS20(raw).BaseScore();
        if (!Number.isFinite(baseScore) || baseScore < 0 || baseScore > 10) continue;
        ratings.push({ vector, version, source: entry.source ?? "OSV", baseScore });
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
