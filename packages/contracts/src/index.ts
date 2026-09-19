export {
  ANALYSIS_REPORT_SCHEMA_VERSION,
  AnalysisReportSchema,
  AnalyzerMetadataSchema,
} from "./analysis-report.js";
export type { AnalysisReport, AnalyzerMetadata } from "./analysis-report.js";

export { ScoreCategorySchema } from "./category.js";
export type { ScoreCategory } from "./category.js";

export {
  AvailableDataSourceSchema,
  DataSourceSchema,
  EvidenceSchema,
  ExternalEvidenceSchema,
  PartialDataSourceSchema,
  ProjectEvidenceSchema,
  SourceLocationSchema,
  UnavailableDataSourceSchema,
} from "./evidence.js";
export type {
  AvailableDataSource,
  DataSource,
  Evidence,
  ExternalEvidence,
  PartialDataSource,
  ProjectEvidence,
  UnavailableDataSource,
} from "./evidence.js";

export {
  AnalysisFactDetailsSchema,
  AnalysisFactSchema,
  DependencyInventoryFactDetailsSchema,
} from "./fact.js";
export type {
  AnalysisFact,
  AnalysisFactDetails,
  DependencyInventoryFactDetails,
} from "./fact.js";

export {
  ConfidenceLevelSchema,
  FactualFindingSchema,
  FindingClassificationSchema,
  FindingPrioritySchema,
  FindingSchema,
  HeuristicConfidenceSchema,
  HeuristicFindingSchema,
  PriorityFactorSchema,
  PriorityLevelSchema,
} from "./finding.js";
export type {
  ConfidenceLevel,
  FactualFinding,
  Finding,
  FindingClassification,
  FindingPriority,
  HeuristicConfidence,
  HeuristicFinding,
  PriorityLevel,
} from "./finding.js";

export { IdentifierSchema, RequirementIdSchema, RuleReferenceSchema } from "./identifiers.js";
export type { RequirementId, RuleReference } from "./identifiers.js";

export {
  AnalysisInputSchema,
  ManifestAnalysisInputSchema,
  RepositoryAnalysisInputSchema,
  RepositoryIdentitySchema,
} from "./input.js";
export type {
  AnalysisInput,
  ManifestAnalysisInput,
  RepositoryAnalysisInput,
  RepositoryIdentity,
} from "./input.js";

export {
  AcquisitionPartialFailureSchema,
  AnalysisLimitationKindSchema,
  AnalysisLimitationSchema,
  PartialFailureSchema,
  RulePartialFailureSchema,
  SourcePartialFailureSchema,
} from "./limitation.js";
export type { AnalysisLimitation, AnalysisLimitationKind, PartialFailure } from "./limitation.js";

export {
  FactualRecommendationSchema,
  HeuristicRecommendationSchema,
  RecommendationSchema,
} from "./recommendation.js";
export type {
  FactualRecommendation,
  HeuristicRecommendation,
  Recommendation,
} from "./recommendation.js";

export {
  AnalysisScoresSchema,
  AvailableScoreSchema,
  CategoryScoresSchema,
  InsufficientEvidenceScoreSchema,
  ScoreContributionDirectionSchema,
  ScoreContributionSchema,
  ScoreResultSchema,
} from "./score.js";
export type {
  AnalysisScores,
  AvailableScore,
  CategoryScores,
  InsufficientEvidenceScore,
  ScoreContribution,
  ScoreContributionDirection,
  ScoreResult,
} from "./score.js";

export { AnalysisSubjectSchema } from "./subject.js";
export type { AnalysisSubject } from "./subject.js";

export { IsoDateTimeSchema } from "./time.js";
export type { IsoDateTime } from "./time.js";
