import * as z from "zod";

import { DataSourceSchema, EvidenceSchema } from "./evidence.js";
import { AnalysisFactSchema, LegacyAnalysisFactSchema } from "./fact.js";
import { FindingSchema, LegacyFindingSchema } from "./finding.js";
import { IdentifierSchema } from "./identifiers.js";
import { AnalysisInputSchema } from "./input.js";
import {
  AnalysisLimitationSchema,
  LegacyAnalysisLimitationSchema,
  PartialFailureSchema,
} from "./limitation.js";
import { RecommendationSchema } from "./recommendation.js";
import { AnalysisScoresV2Schema, LegacyAnalysisScoresSchema } from "./score.js";
import { IsoDateTimeSchema } from "./time.js";

export const ANALYSIS_REPORT_SCHEMA_VERSION = "1.0.0" as const;

export const AnalyzerMetadataSchema = z.strictObject({
  version: IdentifierSchema,
  ruleSetVersion: IdentifierSchema,
  scoringVersion: IdentifierSchema,
});

const AnalysisReportBaseSchema = z.strictObject({
  schemaVersion: z.literal(ANALYSIS_REPORT_SCHEMA_VERSION),
  analysisId: IdentifierSchema,
  createdAt: IsoDateTimeSchema,
  input: AnalysisInputSchema,
  analyzer: AnalyzerMetadataSchema,
  sources: z.array(DataSourceSchema),
  evidence: z.array(EvidenceSchema),
  facts: z.array(LegacyAnalysisFactSchema),
  findings: z.array(LegacyFindingSchema),
  recommendations: z.array(RecommendationSchema),
  scores: LegacyAnalysisScoresSchema,
  limitations: z.array(LegacyAnalysisLimitationSchema),
  partialFailures: z.array(PartialFailureSchema),
});

function idsOf(items: readonly { id: string }[]) {
  return new Set(items.map((item) => item.id));
}

function addMissingReferenceIssue(
  ctx: z.RefinementCtx,
  path: PropertyKey[],
  referenceType: string,
  id: string,
) {
  ctx.addIssue({
    code: "custom",
    path,
    message: `Unknown ${referenceType} reference: ${id}`,
  });
}

function validateUniqueIds(
  ctx: z.RefinementCtx,
  collectionName: string,
  items: readonly { id: string }[],
) {
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: "custom",
        path: [collectionName, index, "id"],
        message: `Duplicate ${collectionName} id: ${item.id}`,
      });
    }

    seen.add(item.id);
  });
}

export const ANALYSIS_REPORT_V2_SCHEMA_VERSION = "2.0.0" as const;
const AnalysisReportV2BaseSchema = AnalysisReportBaseSchema.extend({
  schemaVersion: z.literal(ANALYSIS_REPORT_V2_SCHEMA_VERSION),
  facts: z.array(AnalysisFactSchema),
  findings: z.array(FindingSchema),
  limitations: z.array(AnalysisLimitationSchema),
  scores: AnalysisScoresV2Schema,
});
type ReportForValidation =
  | z.infer<typeof AnalysisReportBaseSchema>
  | z.infer<typeof AnalysisReportV2BaseSchema>;
function validateReport(report: ReportForValidation, ctx: z.RefinementCtx) {
  const sourceIds = idsOf(report.sources);
  const sourcesById = new Map(report.sources.map((source) => [source.id, source]));
  const evidenceIds = idsOf(report.evidence);
  const factIds = idsOf(report.facts);
  const findingIds = idsOf(report.findings);
  const limitationIds = idsOf(report.limitations);
  const contributionIds = idsOf(report.scores.contributions);

  validateUniqueIds(ctx, "sources", report.sources);
  validateUniqueIds(ctx, "evidence", report.evidence);
  validateUniqueIds(ctx, "facts", report.facts);
  validateUniqueIds(ctx, "findings", report.findings);
  validateUniqueIds(ctx, "recommendations", report.recommendations);
  validateUniqueIds(ctx, "limitations", report.limitations);
  validateUniqueIds(ctx, "partialFailures", report.partialFailures);
  validateUniqueIds(ctx, "contributions", report.scores.contributions);

  report.evidence.forEach((evidence, index) => {
    if (evidence.kind !== "external") {
      return;
    }

    const source = sourcesById.get(evidence.sourceId);

    if (source === undefined) {
      addMissingReferenceIssue(ctx, ["evidence", index, "sourceId"], "source", evidence.sourceId);
      return;
    }

    if (source.status === "unavailable") {
      ctx.addIssue({
        code: "custom",
        path: ["evidence", index, "sourceId"],
        message: `External evidence cannot reference unavailable source: ${evidence.sourceId}`,
      });
    }
  });

  report.facts.forEach((fact, factIndex) => {
    fact.evidenceIds.forEach((evidenceId, referenceIndex) => {
      if (!evidenceIds.has(evidenceId)) {
        addMissingReferenceIssue(
          ctx,
          ["facts", factIndex, "evidenceIds", referenceIndex],
          "evidence",
          evidenceId,
        );
      }
    });
  });

  report.findings.forEach((finding, findingIndex) => {
    finding.evidenceIds.forEach((evidenceId, referenceIndex) => {
      if (!evidenceIds.has(evidenceId)) {
        addMissingReferenceIssue(
          ctx,
          ["findings", findingIndex, "evidenceIds", referenceIndex],
          "evidence",
          evidenceId,
        );
      }
    });

    finding.factIds.forEach((factId, referenceIndex) => {
      if (!factIds.has(factId)) {
        addMissingReferenceIssue(
          ctx,
          ["findings", findingIndex, "factIds", referenceIndex],
          "fact",
          factId,
        );
      }
    });

    finding.limitationIds.forEach((limitationId, referenceIndex) => {
      if (!limitationIds.has(limitationId)) {
        addMissingReferenceIssue(
          ctx,
          ["findings", findingIndex, "limitationIds", referenceIndex],
          "limitation",
          limitationId,
        );
      }
    });

    finding.priority.factors.forEach((factor, factorIndex) => {
      factor.evidenceIds.forEach((evidenceId, referenceIndex) => {
        if (!evidenceIds.has(evidenceId)) {
          addMissingReferenceIssue(
            ctx,
            [
              "findings",
              findingIndex,
              "priority",
              "factors",
              factorIndex,
              "evidenceIds",
              referenceIndex,
            ],
            "evidence",
            evidenceId,
          );
        }
      });
    });

    if (finding.classification === "heuristic") {
      finding.confidence.factIds.forEach((factId, referenceIndex) => {
        if (!factIds.has(factId)) {
          addMissingReferenceIssue(
            ctx,
            ["findings", findingIndex, "confidence", "factIds", referenceIndex],
            "fact",
            factId,
          );
          return;
        }

        if (!finding.factIds.includes(factId)) {
          ctx.addIssue({
            code: "custom",
            path: ["findings", findingIndex, "confidence", "factIds", referenceIndex],
            message: `Confidence fact must also be listed in finding.factIds: ${factId}`,
          });
        }
      });
    }
  });

  const findingsById = new Map(report.findings.map((finding) => [finding.id, finding]));

  report.recommendations.forEach((recommendation, recommendationIndex) => {
    const referencedFindings = recommendation.findingIds.flatMap((findingId, referenceIndex) => {
      const finding = findingsById.get(findingId);

      if (finding === undefined) {
        addMissingReferenceIssue(
          ctx,
          ["recommendations", recommendationIndex, "findingIds", referenceIndex],
          "finding",
          findingId,
        );
        return [];
      }

      return [finding];
    });

    if (
      recommendation.basis === "fact" &&
      referencedFindings.some((finding) => finding.classification === "heuristic")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["recommendations", recommendationIndex, "basis"],
        message: "A fact-based recommendation cannot reference heuristic findings",
      });
    }

    if (
      recommendation.basis === "heuristic" &&
      referencedFindings.length > 0 &&
      referencedFindings.every((finding) => finding.classification === "fact")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["recommendations", recommendationIndex, "basis"],
        message: "A heuristic recommendation must reference at least one heuristic finding",
      });
    }

    recommendation.evidenceIds.forEach((evidenceId, referenceIndex) => {
      if (!evidenceIds.has(evidenceId)) {
        addMissingReferenceIssue(
          ctx,
          ["recommendations", recommendationIndex, "evidenceIds", referenceIndex],
          "evidence",
          evidenceId,
        );
      }
    });

    if (recommendation.basis === "heuristic") {
      recommendation.confidence.factIds.forEach((factId, referenceIndex) => {
        if (!factIds.has(factId)) {
          addMissingReferenceIssue(
            ctx,
            ["recommendations", recommendationIndex, "confidence", "factIds", referenceIndex],
            "fact",
            factId,
          );
        }
      });
    }
  });

  report.scores.contributions.forEach((contribution, contributionIndex) => {
    contribution.evidenceIds.forEach((evidenceId, referenceIndex) => {
      if (!evidenceIds.has(evidenceId)) {
        addMissingReferenceIssue(
          ctx,
          ["scores", "contributions", contributionIndex, "evidenceIds", referenceIndex],
          "evidence",
          evidenceId,
        );
      }
    });

    contribution.findingIds.forEach((findingId, referenceIndex) => {
      if (!findingIds.has(findingId)) {
        addMissingReferenceIssue(
          ctx,
          ["scores", "contributions", contributionIndex, "findingIds", referenceIndex],
          "finding",
          findingId,
        );
      }
    });

    contribution.factIds.forEach((factId, referenceIndex) => {
      if (!factIds.has(factId)) {
        addMissingReferenceIssue(
          ctx,
          ["scores", "contributions", contributionIndex, "factIds", referenceIndex],
          "fact",
          factId,
        );
      }
    });
  });

  const scoreEntries = [
    { path: ["scores", "overall"], score: report.scores.overall },
    ...(["dependencies", "security", "maintainability", "testing", "tooling"] as const).map(
      (category) => ({
        path: ["scores", "categories", category],
        score: report.scores.categories[category],
      }),
    ),
  ] as const;

  scoreEntries.forEach(({ path, score }) => {
    if ("checkFactIds" in score) {
      const seenChecks = new Set<string>();
      const actual = { passed: 0, failed: 0, unknown: 0, notApplicable: 0 };
      score.checkFactIds.forEach((id, index) => {
        if (seenChecks.has(id))
          ctx.addIssue({
            code: "custom",
            path: [...path, "checkFactIds", index],
            message: "Duplicate inspection check reference",
          });
        seenChecks.add(id);
        const fact = report.facts.find((item) => item.id === id);
        if (fact === undefined || fact.details?.kind !== "inspection_check")
          addMissingReferenceIssue(
            ctx,
            [...path, "checkFactIds", index],
            "inspection check fact",
            id,
          );
        else {
          const check = fact.details;
          actual[
            check.state === "pass"
              ? "passed"
              : check.state === "fail"
                ? "failed"
                : check.state === "unknown"
                  ? "unknown"
                  : "notApplicable"
          ] += 1;
          if (path[1] === "categories" && check.category !== path[2])
            ctx.addIssue({
              code: "custom",
              path: [...path, "checkFactIds", index],
              message: "Inspection check belongs to another category",
            });
        }
      });
      for (const key of ["passed", "failed", "unknown", "notApplicable"] as const)
        if (actual[key] !== score.checkCounts[key])
          ctx.addIssue({
            code: "custom",
            path: [...path, "checkCounts", key],
            message: "Check count disagrees with referenced inspection checks",
          });
      if (score.status === "not_applicable" && actual.passed + actual.failed + actual.unknown > 0)
        ctx.addIssue({
          code: "custom",
          path: [...path, "status"],
          message: "Not-applicable scores cannot contain applicable checks",
        });
    }
    if (score.status === "available") {
      score.contributionIds.forEach((contributionId, referenceIndex) => {
        if (!contributionIds.has(contributionId)) {
          addMissingReferenceIssue(
            ctx,
            [...path, "contributionIds", referenceIndex],
            "score contribution",
            contributionId,
          );
        }
      });
    } else if (score.status === "insufficient_evidence") {
      score.limitationIds.forEach((limitationId, referenceIndex) => {
        if (!limitationIds.has(limitationId)) {
          addMissingReferenceIssue(
            ctx,
            [...path, "limitationIds", referenceIndex],
            "limitation",
            limitationId,
          );
        }
      });
    }
  });

  report.limitations.forEach((limitation, limitationIndex) => {
    limitation.sourceIds.forEach((sourceId, referenceIndex) => {
      if (!sourceIds.has(sourceId)) {
        addMissingReferenceIssue(
          ctx,
          ["limitations", limitationIndex, "sourceIds", referenceIndex],
          "source",
          sourceId,
        );
      }
    });
  });

  report.partialFailures.forEach((failure, failureIndex) => {
    if (failure.scope === "source" && !sourceIds.has(failure.sourceId)) {
      addMissingReferenceIssue(
        ctx,
        ["partialFailures", failureIndex, "sourceId"],
        "source",
        failure.sourceId,
      );
    }
  });
  if (report.schemaVersion === "2.0.0") {
    report.facts.forEach((fact, index) => {
      if (fact.details?.kind === "inspection_check") {
        fact.details.limitationIds.forEach((id, i) => {
          if (!limitationIds.has(id))
            addMissingReferenceIssue(
              ctx,
              ["facts", index, "details", "limitationIds", i],
              "limitation",
              id,
            );
        });
      }
    });
  }
}
export const AnalysisReportV1Schema = AnalysisReportBaseSchema.superRefine(validateReport);
export const AnalysisReportV2Schema = AnalysisReportV2BaseSchema.superRefine(validateReport);
export const AnalysisReportSchema = z.discriminatedUnion("schemaVersion", [
  AnalysisReportV1Schema,
  AnalysisReportV2Schema,
]);
export type AnalysisReportV1 = z.infer<typeof AnalysisReportV1Schema>;
export type AnalysisReportV2 = z.infer<typeof AnalysisReportV2Schema>;

export type AnalyzerMetadata = z.infer<typeof AnalyzerMetadataSchema>;
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
