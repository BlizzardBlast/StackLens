export {
  ANALYSIS_REPORT_SCHEMA_VERSION,
  AnalysisReportSchema,
  AnalyzerMetadataSchema
} from "./analysis-report.js";
export type { AnalysisReport, AnalyzerMetadata } from "./analysis-report.js";

export {
  DataSourceSchema,
  DataSourceStatusSchema,
  EvidenceSchema,
  ExternalEvidenceSchema,
  IsoDateTimeSchema,
  ProjectEvidenceSchema,
  SourceLocationSchema
} from "./evidence.js";
export type {
  DataSource,
  DataSourceStatus,
  Evidence,
  ExternalEvidence,
  ProjectEvidence
} from "./evidence.js";

export { AnalysisFactSchema } from "./fact.js";
export type { AnalysisFact } from "./fact.js";

export {
  ConfidenceLevelSchema,
  FactualFindingSchema,
  FindingClassificationSchema,
  FindingPrioritySchema,
  FindingSchema,
  HeuristicConfidenceSchema,
  HeuristicFindingSchema,
  PriorityFactorSchema,
  PriorityLevelSchema
} from "./finding.js";
export type {
  ConfidenceLevel,
  FactualFinding,
  Finding,
  FindingClassification,
  FindingPriority,
  HeuristicConfidence,
  HeuristicFinding,
  PriorityLevel
} from "./finding.js";

export {
  AnalysisSubjectSchema,
  IdentifierSchema,
  RequirementIdSchema,
  RuleReferenceSchema
} from "./identifiers.js";
export type {
  AnalysisSubject,
  RequirementId,
  RuleReference
} from "./identifiers.js";

export {
  AnalysisInputSchema,
  ManifestAnalysisInputSchema,
  RepositoryAnalysisInputSchema,
  RepositoryIdentitySchema
} from "./input.js";
export type {
  AnalysisInput,
  ManifestAnalysisInput,
  RepositoryAnalysisInput,
  RepositoryIdentity
} from "./input.js";

export {
  AcquisitionPartialFailureSchema,
  AnalysisLimitationKindSchema,
  AnalysisLimitationSchema,
  PartialFailureSchema,
  RulePartialFailureSchema,
  ScoreCategorySchema,
  SourcePartialFailureSchema
} from "./limitation.js";
export type {
  AnalysisLimitation,
  AnalysisLimitationKind,
  PartialFailure,
  ScoreCategory
} from "./limitation.js";

export {
  FactualRecommendationSchema,
  HeuristicRecommendationSchema,
  RecommendationSchema
} from "./recommendation.js";
export type {
  FactualRecommendation,
  HeuristicRecommendation,
  Recommendation
} from "./recommendation.js";

export {
  AnalysisScoresSchema,
  AvailableScoreSchema,
  CategoryScoresSchema,
  InsufficientEvidenceScoreSchema,
  ScoreContributionDirectionSchema,
  ScoreContributionSchema,
  ScoreResultSchema
} from "./score.js";
export type {
  AnalysisScores,
  AvailableScore,
  CategoryScores,
  InsufficientEvidenceScore,
  ScoreContribution,
  ScoreContributionDirection,
  ScoreResult
} from "./score.js";
