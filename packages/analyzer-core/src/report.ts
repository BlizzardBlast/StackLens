import { ANALYSIS_REPORT_SCHEMA_VERSION, AnalysisReportSchema } from "@stacklens/contracts";
import type {
  AnalysisInput,
  AnalysisReport,
  AnalysisScores,
  AnalyzerMetadata,
  DataSource,
  Evidence,
} from "@stacklens/contracts";

import type { RulePipelineResult } from "./pipeline.js";

export interface AnalysisReportAssemblyInput {
  readonly analysisId: string;
  readonly createdAt: string;
  readonly input: AnalysisInput;
  readonly analyzer: AnalyzerMetadata;
  readonly sources: readonly DataSource[];
  readonly evidence: readonly Evidence[];
  readonly ruleResult: RulePipelineResult;
  readonly scores: AnalysisScores;
}

export function assembleAnalysisReport(input: AnalysisReportAssemblyInput): AnalysisReport {
  return AnalysisReportSchema.parse({
    schemaVersion: ANALYSIS_REPORT_SCHEMA_VERSION,
    analysisId: input.analysisId,
    createdAt: input.createdAt,
    input: input.input,
    analyzer: input.analyzer,
    sources: [...input.sources],
    evidence: [...input.evidence],
    facts: [...input.ruleResult.facts],
    findings: [...input.ruleResult.findings],
    recommendations: [...input.ruleResult.recommendations],
    scores: input.scores,
    limitations: [...input.ruleResult.limitations],
    partialFailures: [...input.ruleResult.partialFailures],
  });
}
