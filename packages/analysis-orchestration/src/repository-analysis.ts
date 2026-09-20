import { runAnalyzer } from "@stacklens/analyzer-core";
import type { AnalyzerDefinition } from "@stacklens/analyzer-core";
import type {
  AnalysisLimitation,
  AnalysisReport,
  DataSource,
  Evidence,
  PartialFailure,
  RepositoryIdentity,
} from "@stacklens/contracts";
import type {
  EvidenceProvider,
  GitHubRepositoryRequest,
  GitHubRepositorySnapshot,
  NpmPackageMetadata,
  NpmPackageMetadataRequest,
  OsvVulnerabilityRequest,
  OsvVulnerabilitySnapshot,
  ProviderResult,
} from "@stacklens/data-sources";
import {
  createDependencyInventoryEvidence,
  createJavaScriptProjectSnapshot,
  createProjectConfigurationEvidence,
  createSourceUsageEvidence,
  normalizePackageManifest,
  normalizePackageScripts,
  parseExactSemanticVersion,
  withJavaScriptSourceUsage,
} from "@stacklens/rules-javascript";
import type {
  JavaScriptAnalysisMetadata,
  JavaScriptProjectSnapshot,
  NormalizedDependencyDeclaration,
} from "@stacklens/rules-javascript";

import { productionJavaScriptAnalyzer } from "./production-javascript-analyzer.js";

export const REPOSITORY_ANALYSIS_MAX_METADATA_PACKAGES = 100;
export const REPOSITORY_ANALYSIS_MAX_OSV_QUERIES = 100;
const REPOSITORY_ANALYSIS_METADATA_CONCURRENCY = 4;
export const REPOSITORY_METADATA_LIMITATION_ID =
  "limitation-repository-analysis-metadata-package-limit";
export const REPOSITORY_OSV_LIMITATION_ID = "limitation-repository-analysis-osv-query-limit";

export type RepositoryAnalysisProgressPhase =
  | "repository"
  | "manifest"
  | "package_metadata"
  | "vulnerability_data"
  | "analysis";

export type RepositoryAnalysisProgressStatus =
  | "started"
  | "progress"
  | "completed"
  | "failed"
  | "skipped";

export interface RepositoryAnalysisProgress {
  readonly phase: RepositoryAnalysisProgressPhase;
  readonly status: RepositoryAnalysisProgressStatus;
  readonly completed?: number;
  readonly total?: number;
  readonly failed?: number;
}

export interface RepositoryAnalysisCommand {
  readonly analysisId: string;
  readonly createdAt: string;
  readonly repositoryUrl: string;
  readonly ref?: string;
}

export type RepositoryAnalysisErrorCode =
  | "repository_unavailable"
  | "missing_manifest"
  | "invalid_manifest";

export interface RepositoryAnalysisError {
  readonly code: RepositoryAnalysisErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly requirementIds: readonly ["FR-003", "FR-004"];
  readonly providerFailureCode?: string;
}

export interface RepositoryAnalysisDependencies {
  readonly githubRepositoryProvider: EvidenceProvider<
    GitHubRepositoryRequest,
    GitHubRepositorySnapshot
  >;
  readonly npmRegistryProvider: EvidenceProvider<NpmPackageMetadataRequest, NpmPackageMetadata>;
  readonly osvProvider: EvidenceProvider<OsvVulnerabilityRequest, OsvVulnerabilitySnapshot>;
  readonly analyzer?: AnalyzerDefinition<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>;
  readonly onProgress?: (progress: RepositoryAnalysisProgress) => void | Promise<void>;
}

export type RepositoryAnalysisResult =
  | {
      readonly ok: true;
      readonly report: AnalysisReport;
      readonly progress: readonly RepositoryAnalysisProgress[];
    }
  | {
      readonly ok: false;
      readonly error: RepositoryAnalysisError;
      readonly progress: readonly RepositoryAnalysisProgress[];
    };

interface ParsedRepositoryManifest {
  readonly project: JavaScriptProjectSnapshot;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function repositoryFingerprint(repository: RepositoryIdentity): string {
  return `github:${repository.owner}/${repository.name}@${repository.commitSha}`;
}

function uniquePackageNames(
  declarations: readonly NormalizedDependencyDeclaration[],
): readonly string[] {
  return [...new Set(declarations.map((declaration) => declaration.name))].toSorted(
    compareCodeUnits,
  );
}

function providerArtifacts<TData>(result: ProviderResult<TData>): {
  readonly sources: readonly DataSource[];
  readonly evidence: readonly Evidence[];
  readonly partialFailures: readonly PartialFailure[];
} {
  return result.ok
    ? {
        sources: [result.source],
        evidence: result.evidence,
        partialFailures: result.partialFailures,
      }
    : {
        sources: [result.source],
        evidence: [],
        partialFailures: [result.failure],
      };
}

function metadataLimitations(
  totalPackages: number,
  selectedPackages: number,
  totalQueries: number,
  selectedQueries: number,
): AnalysisLimitation[] {
  const limitations: AnalysisLimitation[] = [];

  if (selectedPackages < totalPackages) {
    limitations.push({
      id: REPOSITORY_METADATA_LIMITATION_ID,
      kind: "resource_limit",
      message:
        `Repository metadata acquisition is bounded to ${REPOSITORY_ANALYSIS_MAX_METADATA_PACKAGES} unique package(s) per analysis. ` +
        `${totalPackages - selectedPackages} additional package(s) were not enriched, so affected dependency/security conclusions remain limited rather than being treated as negative evidence.`,
      affectedCategories: ["dependencies", "security", "maintainability"],
      sourceIds: [],
      ruleIds: [],
    });
  }

  if (selectedQueries < totalQueries) {
    limitations.push({
      id: REPOSITORY_OSV_LIMITATION_ID,
      kind: "resource_limit",
      message:
        `Repository vulnerability acquisition is bounded to ${REPOSITORY_ANALYSIS_MAX_OSV_QUERIES} exact package/version query or queries per analysis. ` +
        `${totalQueries - selectedQueries} additional exact-version query or queries were not sent, so Security remains limited rather than being treated as clean evidence.`,
      affectedCategories: ["security"],
      sourceIds: [],
      ruleIds: [],
    });
  }

  return limitations;
}

function exactOsvQueries(
  declarations: readonly NormalizedDependencyDeclaration[],
  selectedPackages: ReadonlySet<string>,
): readonly { readonly packageName: string; readonly version: string }[] {
  const queries = new Map<string, { readonly packageName: string; readonly version: string }>();

  for (const declaration of declarations) {
    if (
      !selectedPackages.has(declaration.name) ||
      parseExactSemanticVersion(declaration.declaredSpecifier) === undefined
    ) {
      continue;
    }

    const key = JSON.stringify([declaration.name, declaration.declaredSpecifier]);
    queries.set(key, {
      packageName: declaration.name,
      version: declaration.declaredSpecifier,
    });
  }

  return [...queries.values()].toSorted((left, right) => {
    const packageOrder = compareCodeUnits(left.packageName, right.packageName);
    return packageOrder === 0 ? compareCodeUnits(left.version, right.version) : packageOrder;
  });
}

function parseRepositoryManifest(
  snapshot: GitHubRepositorySnapshot,
): ParsedRepositoryManifest | undefined {
  if (snapshot.manifest === undefined) {
    return undefined;
  }

  const rawManifest = JSON.parse(snapshot.manifest.content) as unknown;
  const manifest = normalizePackageManifest(rawManifest);
  const scripts = normalizePackageScripts(rawManifest);
  const projectFiles = snapshot.files.map((file) => ({
    path: file.path,
    content: file.content,
  }));
  const project = withJavaScriptSourceUsage(
    createJavaScriptProjectSnapshot(manifest, projectFiles, { scripts }),
    snapshot.sourceCoverage.status,
  );

  return {
    project,
  };
}

function terminalError(
  code: RepositoryAnalysisErrorCode,
  message: string,
  retryable: boolean,
  providerFailureCode?: string,
): RepositoryAnalysisError {
  return {
    code,
    message,
    retryable,
    requirementIds: ["FR-003", "FR-004"],
    ...(providerFailureCode === undefined ? {} : { providerFailureCode }),
  };
}

export async function analyzePublicGitHubRepository(
  command: RepositoryAnalysisCommand,
  dependencies: RepositoryAnalysisDependencies,
): Promise<RepositoryAnalysisResult> {
  const progress: RepositoryAnalysisProgress[] = [];
  const recordProgress = (event: RepositoryAnalysisProgress) => {
    progress.push(event);
    dependencies.onProgress?.(event);
  };

  await recordProgress({
    phase: "repository",
    status: "started",
  });

  const repositoryResult = await dependencies.githubRepositoryProvider.fetch({
    repositoryUrl: command.repositoryUrl,
    ...(command.ref === undefined ? {} : { ref: command.ref }),
  });

  if (!repositoryResult.ok) {
    await recordProgress({
      phase: "repository",
      status: "failed",
      failed: 1,
    });

    return {
      ok: false,
      error: terminalError(
        "repository_unavailable",
        repositoryResult.failure.message,
        repositoryResult.failure.retryable,
        repositoryResult.failure.code,
      ),
      progress,
    };
  }

  await recordProgress({
    phase: "repository",
    status: "completed",
  });
  await recordProgress({
    phase: "manifest",
    status: "started",
  });

  if (repositoryResult.data.manifest === undefined) {
    await recordProgress({
      phase: "manifest",
      status: "failed",
      failed: 1,
    });

    return {
      ok: false,
      error: terminalError(
        "missing_manifest",
        "Repository analysis requires a supported root package.json.",
        false,
      ),
      progress,
    };
  }

  let parsedManifest: ParsedRepositoryManifest;

  try {
    const parsed = parseRepositoryManifest(repositoryResult.data);

    if (parsed === undefined) {
      throw new TypeError("manifest unavailable");
    }

    parsedManifest = parsed;
  } catch {
    await recordProgress({
      phase: "manifest",
      status: "failed",
      failed: 1,
    });

    return {
      ok: false,
      error: terminalError(
        "invalid_manifest",
        "Repository root package.json must contain supported JSON package-manifest and script shapes.",
        false,
      ),
      progress,
    };
  }

  await recordProgress({
    phase: "manifest",
    status: "completed",
  });

  const packageNames = uniquePackageNames(parsedManifest.project.dependencies);
  const selectedPackageNames = packageNames.slice(0, REPOSITORY_ANALYSIS_MAX_METADATA_PACKAGES);
  const selectedPackageSet = new Set(selectedPackageNames);
  const npmMetadata: NonNullable<JavaScriptAnalysisMetadata["npmRegistry"]>[number][] = [];
  const sources: DataSource[] = [repositoryResult.source];
  const evidence: Evidence[] = [
    ...repositoryResult.evidence,
    ...createDependencyInventoryEvidence(parsedManifest.project),
    ...createProjectConfigurationEvidence(parsedManifest.project),
    ...createSourceUsageEvidence(parsedManifest.project),
  ];
  const partialFailures: PartialFailure[] = [...repositoryResult.partialFailures];
  const limitations: AnalysisLimitation[] = [...repositoryResult.data.limitations];

  await recordProgress({
    phase: "package_metadata",
    status: "started",
    completed: 0,
    total: selectedPackageNames.length,
    failed: 0,
  });

  let npmFailures = 0;

  const acquireNpmBatch = async (offset: number): Promise<void> => {
    if (offset >= selectedPackageNames.length) {
      return;
    }

    const batch = selectedPackageNames.slice(
      offset,
      offset + REPOSITORY_ANALYSIS_METADATA_CONCURRENCY,
    );
    const results = await Promise.all(
      batch.map((packageName) => dependencies.npmRegistryProvider.fetch({ packageName })),
    );

    for (const [batchIndex, result] of results.entries()) {
      const artifacts = providerArtifacts(result);
      sources.push(...artifacts.sources);
      evidence.push(...artifacts.evidence);
      partialFailures.push(...artifacts.partialFailures);

      if (result.ok) {
        npmMetadata.push({
          sourceId: result.source.id,
          snapshot: result.data,
        });
      } else {
        npmFailures += 1;
      }

      await recordProgress({
        phase: "package_metadata",
        status: "progress",
        completed: offset + batchIndex + 1,
        total: selectedPackageNames.length,
        failed: npmFailures,
      });
    }

    await acquireNpmBatch(offset + batch.length);
  };

  await acquireNpmBatch(0);

  await recordProgress({
    phase: "package_metadata",
    status: "completed",
    completed: selectedPackageNames.length,
    total: selectedPackageNames.length,
    failed: npmFailures,
  });

  const allOsvQueries = exactOsvQueries(parsedManifest.project.dependencies, selectedPackageSet);
  const selectedOsvQueries = allOsvQueries.slice(0, REPOSITORY_ANALYSIS_MAX_OSV_QUERIES);
  let osvMetadata: JavaScriptAnalysisMetadata["osv"];

  limitations.push(
    ...metadataLimitations(
      packageNames.length,
      selectedPackageNames.length,
      allOsvQueries.length,
      selectedOsvQueries.length,
    ),
  );

  if (selectedOsvQueries.length === 0) {
    await recordProgress({
      phase: "vulnerability_data",
      status: "skipped",
      completed: 0,
      total: 0,
      failed: 0,
    });
  } else {
    await recordProgress({
      phase: "vulnerability_data",
      status: "started",
      completed: 0,
      total: selectedOsvQueries.length,
      failed: 0,
    });

    const osvResult = await dependencies.osvProvider.fetch({
      queries: selectedOsvQueries,
    });
    const artifacts = providerArtifacts(osvResult);
    sources.push(...artifacts.sources);
    evidence.push(...artifacts.evidence);
    partialFailures.push(...artifacts.partialFailures);

    if (osvResult.ok) {
      osvMetadata = {
        sourceId: osvResult.source.id,
        snapshot: osvResult.data,
      };
    }

    await recordProgress({
      phase: "vulnerability_data",
      status: osvResult.ok ? "completed" : "failed",
      completed: osvResult.ok ? selectedOsvQueries.length : 0,
      total: selectedOsvQueries.length,
      failed: osvResult.ok ? 0 : 1,
    });
  }

  const metadata: JavaScriptAnalysisMetadata = {
    ...(npmMetadata.length === 0 ? {} : { npmRegistry: npmMetadata }),
    ...(osvMetadata === undefined ? {} : { osv: osvMetadata }),
  };

  await recordProgress({
    phase: "analysis",
    status: "started",
  });

  const report = runAnalyzer(dependencies.analyzer ?? productionJavaScriptAnalyzer, {
    analysisId: command.analysisId,
    createdAt: command.createdAt,
    input: {
      type: "repository",
      fingerprint: repositoryFingerprint(repositoryResult.data.repository),
      repository: repositoryResult.data.repository,
    },
    project: parsedManifest.project,
    metadata,
    sources,
    evidence,
    limitations,
    partialFailures,
  });

  await recordProgress({
    phase: "analysis",
    status: "completed",
  });

  return {
    ok: true,
    report,
    progress,
  };
}
