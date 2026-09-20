import type { FactRule } from "@stacklens/analyzer-core";
import type {
  AnalysisFact,
  AnalysisLimitation,
  ExternalEvidence,
  ScoreCategory,
} from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import { dependencyInventoryEvidenceId } from "./dependency-inventory.js";
import { latestDistTag, packageVersion, resolveNpmObservation } from "./npm-rule-support.js";
import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import {
  createDependencyRuleLimitation,
  dependencyDeclarationBases,
  dependencyKey,
  truncate,
  uniqueSorted,
} from "./rule-support.js";
import { parseExactSemanticVersion } from "./semver.js";
import { sourceUsageCoverageEvidenceId } from "./source-usage.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-COVERAGE-018";
const RULE_VERSION = "1";
const OSV_PROVIDER_ID = "osv";

export function analysisCoverageFactType(category: ScoreCategory): string {
  return `analysis.coverage.${category}`;
}

export function analysisCoverageFactId(category: ScoreCategory): string {
  return `fact-js-coverage-${category}`;
}

function limitationId(category: ScoreCategory, code: string): string {
  return `limitation-js-coverage-${stableHash(JSON.stringify([category, code]))}`;
}

function coverageLimitation(
  category: ScoreCategory,
  code: string,
  message: string,
  sourceIds: readonly string[] = [],
): AnalysisLimitation {
  return {
    id: limitationId(category, code),
    kind: "insufficient_evidence",
    message: truncate(message, 4_000),
    affectedCategories: [category],
    sourceIds: [...sourceIds],
    ruleIds: [RULE_ID],
  };
}

function createCoverageFact(
  category: ScoreCategory,
  statement: string,
  evidenceIds: readonly string[],
): AnalysisFact {
  return {
    id: analysisCoverageFactId(category),
    type: analysisCoverageFactType(category),
    subject: {
      type: "analysis_coverage",
      name: `${category} scoring coverage`,
    },
    statement: truncate(statement, 4_000),
    rule: {
      id: RULE_ID,
      version: RULE_VERSION,
    },
    requirementIds: ["FR-018", "FR-019", "FR-020", "SCORE-003"],
    evidenceIds: [...uniqueSorted(evidenceIds)],
  };
}

function externalEvidenceOnly(
  evidence: readonly { readonly kind: string }[],
): readonly ExternalEvidence[] {
  return evidence.filter((item): item is ExternalEvidence => item.kind === "external");
}

function osvQueryEvidenceReference(packageName: string, version: string): string {
  return `npm:${packageName}@${version}`;
}

function dependencyCoverage(
  context: Parameters<
    FactRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>["evaluate"]
  >[0],
): { readonly fact?: AnalysisFact; readonly limitations: readonly AnalysisLimitation[] } {
  if (context.project.dependencies.length === 0) {
    return {
      limitations: [
        coverageLimitation(
          "dependencies",
          "no-dependencies",
          "Dependency health scoring is unavailable because the project snapshot contains no supported dependency declarations.",
        ),
      ],
    };
  }

  const sourceUsage = context.project.sourceUsage;

  if (sourceUsage?.coverage !== "complete") {
    return {
      limitations: [
        coverageLimitation(
          "dependencies",
          "source-usage-incomplete",
          "Dependency health scoring requires complete supported static source/configuration/script usage coverage so missing usage cannot be converted into a score penalty.",
        ),
      ],
    };
  }

  const limitations: AnalysisLimitation[] = [];
  const evidenceIds: string[] = [];
  let complete = true;
  const knownEvidence = new Set(context.evidence.map((evidence) => evidence.id));

  for (const declaration of context.project.dependencies) {
    const evidenceId = dependencyInventoryEvidenceId(declaration);

    if (!knownEvidence.has(evidenceId)) {
      complete = false;
      limitations.push(
        coverageLimitation(
          "dependencies",
          `dependency-evidence-missing:${evidenceId}`,
          `Dependency scoring coverage is missing project evidence for ${declaration.name} declared in ${declaration.group}.`,
        ),
      );
    } else {
      evidenceIds.push(evidenceId);
    }
  }

  const sourceCoverageEvidenceId = sourceUsageCoverageEvidenceId(sourceUsage);

  if (!knownEvidence.has(sourceCoverageEvidenceId)) {
    complete = false;
    limitations.push(
      coverageLimitation(
        "dependencies",
        "source-coverage-evidence-missing",
        "Dependency scoring coverage is missing the static source-usage coverage evidence record.",
      ),
    );
  } else {
    evidenceIds.push(sourceCoverageEvidenceId);
  }

  for (const basis of dependencyDeclarationBases(context.project)) {
    const unsupportedDeclarations = basis.declarations.filter(
      (declaration) => parseExactSemanticVersion(declaration.declaredSpecifier) === undefined,
    );

    if (unsupportedDeclarations.length > 0) {
      complete = false;

      for (const declaration of unsupportedDeclarations) {
        limitations.push(
          coverageLimitation(
            "dependencies",
            `non-exact-version:${dependencyKey(declaration.name, declaration.declaredSpecifier)}`,
            `Dependency scoring cannot establish complete version-health coverage for ${declaration.name} because ${JSON.stringify(
              declaration.declaredSpecifier,
            )} is not an exact supported semantic version.`,
          ),
        );
      }

      continue;
    }

    const resolved = resolveNpmObservation({
      ruleId: RULE_ID,
      packageName: basis.packageName,
      metadata: context.metadata,
      sources: context.sources,
      evidence: context.evidence,
    });

    limitations.push(...resolved.limitations);

    if (!resolved.ok || resolved.limitations.length > 0) {
      complete = false;
      continue;
    }

    let currentVersionsComplete = true;

    for (const declaration of basis.declarations) {
      if (
        packageVersion(resolved.observation.snapshot, declaration.declaredSpecifier) === undefined
      ) {
        currentVersionsComplete = false;
        complete = false;
        limitations.push(
          createDependencyRuleLimitation(
            RULE_ID,
            "insufficient_evidence",
            "scoring-npm-current-version-incomplete",
            dependencyKey(declaration.name, declaration.declaredSpecifier),
            `Dependency scoring coverage requires the npm Registry snapshot for ${declaration.name} to include declared exact version ${declaration.declaredSpecifier}.`,
            [resolved.observation.source.id],
          ),
        );
      }
    }

    const latest = latestDistTag(resolved.observation.snapshot);
    const latestVersion =
      latest === undefined
        ? undefined
        : packageVersion(resolved.observation.snapshot, latest.version);

    if (latest === undefined || latestVersion === undefined) {
      complete = false;
      limitations.push(
        createDependencyRuleLimitation(
          RULE_ID,
          "insufficient_evidence",
          "scoring-npm-latest-incomplete",
          basis.packageName,
          `Dependency scoring coverage requires a supported npm latest dist-tag and matching version record for ${basis.packageName}.`,
          [resolved.observation.source.id],
        ),
      );
      continue;
    }

    if (!currentVersionsComplete) {
      continue;
    }

    evidenceIds.push(...resolved.observation.evidence.map((evidence) => evidence.id));
  }

  if (!complete || limitations.length > 0) {
    return { limitations };
  }

  return {
    fact: createCoverageFact(
      "dependencies",
      `Dependency scoring coverage is complete for ${context.project.dependencies.length} supported declaration(s): manifest evidence, npm latest metadata, and static source/configuration/script usage coverage are available.`,
      evidenceIds,
    ),
    limitations: [],
  };
}

function securityCoverage(
  context: Parameters<
    FactRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>["evaluate"]
  >[0],
): { readonly fact?: AnalysisFact; readonly limitations: readonly AnalysisLimitation[] } {
  if (context.project.dependencies.length === 0) {
    return {
      limitations: [
        coverageLimitation(
          "security",
          "no-dependencies",
          "Known-vulnerability scoring is unavailable because the project snapshot contains no supported dependency declarations.",
        ),
      ],
    };
  }

  const osvMetadata = context.metadata.osv;
  const boundSource =
    osvMetadata === undefined
      ? undefined
      : context.sources.find((source) => source.id === osvMetadata.sourceId);

  if (
    osvMetadata === undefined ||
    boundSource === undefined ||
    boundSource.provider !== OSV_PROVIDER_ID ||
    boundSource.status !== "available"
  ) {
    return {
      limitations: [
        coverageLimitation(
          "security",
          "osv-source-incomplete",
          "Security scoring requires one complete bound OSV source and exact-version query coverage for every supported dependency declaration.",
          boundSource === undefined ? [] : [boundSource.id],
        ),
      ],
    };
  }

  const evidenceIds: string[] = [];
  const limitations: AnalysisLimitation[] = [];
  const knownEvidence = new Set(context.evidence.map((evidence) => evidence.id));
  const externalEvidence = externalEvidenceOnly(context.evidence);
  const uniqueDependencies = new Map<
    string,
    { readonly packageName: string; readonly version: string }
  >();

  for (const declaration of context.project.dependencies) {
    if (parseExactSemanticVersion(declaration.declaredSpecifier) === undefined) {
      limitations.push(
        coverageLimitation(
          "security",
          `non-exact-version:${dependencyKey(declaration.name, declaration.declaredSpecifier)}`,
          `Security scoring cannot establish complete known-vulnerability coverage for ${declaration.name} because ${JSON.stringify(declaration.declaredSpecifier)} is not an exact supported semantic version.`,
          [boundSource.id],
        ),
      );
      continue;
    }

    uniqueDependencies.set(dependencyKey(declaration.name, declaration.declaredSpecifier), {
      packageName: declaration.name,
      version: declaration.declaredSpecifier,
    });

    const projectEvidenceId = dependencyInventoryEvidenceId(declaration);

    if (knownEvidence.has(projectEvidenceId)) {
      evidenceIds.push(projectEvidenceId);
    } else {
      limitations.push(
        coverageLimitation(
          "security",
          `dependency-evidence-missing:${projectEvidenceId}`,
          `Security scoring coverage is missing project evidence for ${declaration.name}@${declaration.declaredSpecifier}.`,
          [boundSource.id],
        ),
      );
    }
  }

  for (const dependency of uniqueDependencies.values()) {
    const queryResults = osvMetadata.snapshot.queryResults.filter(
      (result) =>
        result.packageName === dependency.packageName && result.version === dependency.version,
    );

    if (queryResults.length === 0 || queryResults.some((result) => !result.complete)) {
      limitations.push(
        coverageLimitation(
          "security",
          `osv-query-incomplete:${dependencyKey(dependency.packageName, dependency.version)}`,
          `Security scoring lacks a complete OSV exact-version query result for ${dependency.packageName}@${dependency.version}.`,
          [boundSource.id],
        ),
      );
      continue;
    }

    const reference = osvQueryEvidenceReference(dependency.packageName, dependency.version);
    const queryEvidence = externalEvidence.filter(
      (evidence) => evidence.sourceId === boundSource.id && evidence.reference === reference,
    );

    if (queryEvidence.length === 0) {
      limitations.push(
        coverageLimitation(
          "security",
          `osv-query-evidence-missing:${dependencyKey(dependency.packageName, dependency.version)}`,
          `Security scoring lacks provenance evidence for the complete OSV query of ${dependency.packageName}@${dependency.version}.`,
          [boundSource.id],
        ),
      );
      continue;
    }

    evidenceIds.push(...queryEvidence.map((evidence) => evidence.id));
  }

  if (limitations.length > 0) {
    return { limitations };
  }

  return {
    fact: createCoverageFact(
      "security",
      `Security scoring coverage is complete for ${uniqueDependencies.size} exact dependency version(s): each has a complete OSV query with source-bound provenance evidence.`,
      evidenceIds,
    ),
    limitations: [],
  };
}

export const scoringCoverageFactRule: FactRule<
  JavaScriptProjectSnapshot,
  JavaScriptAnalysisMetadata
> = {
  kind: "fact",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-018",
    "FR-019",
    "FR-020",
    "FR-021",
    "SCORE-001",
    "SCORE-002",
    "SCORE-003",
    "SCORE-004",
    "NFR-001",
    "NFR-002",
    "NFR-004",
  ],
  evaluate(context) {
    const dependencies = dependencyCoverage(context);
    const security = securityCoverage(context);
    const unsupportedCategories: readonly ScoreCategory[] = [
      "maintainability",
      "testing",
      "tooling",
    ];
    const unsupportedLimitations = unsupportedCategories.map((category) =>
      coverageLimitation(
        category,
        "category-policy-not-implemented",
        `${category} scoring is N/A in scoring policy v1 because StackLens does not yet have accepted complete evidence coverage and deductions for that category. Missing evidence is not converted into a penalty.`,
      ),
    );

    return {
      facts: [
        ...(dependencies.fact === undefined ? [] : [dependencies.fact]),
        ...(security.fact === undefined ? [] : [security.fact]),
      ],
      limitations: [
        ...dependencies.limitations,
        ...security.limitations,
        ...unsupportedLimitations,
      ],
    };
  },
};
