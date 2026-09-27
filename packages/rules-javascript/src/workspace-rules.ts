import type {
  FactRule,
  FindingRule,
  RecommendationRule,
  DeepReadonly,
} from "@stacklens/analyzer-core";
import type {
  AnalysisFact,
  AnalysisLimitation,
  Evidence,
  Finding,
  ProjectEvidence,
} from "@stacklens/contracts";

import type { JavaScriptAnalysisMetadata } from "./analysis-metadata.js";
import { createDependencyInventoryEvidence } from "./dependency-inventory.js";
import { createResolvedDependencyEvidence } from "./lockfile.js";
import { isSupportedLockfilePath } from "./lockfile.js";
import { createProjectConfigurationEvidence } from "./project-configuration.js";
import { createReadinessEvidence } from "./project-readiness.js";
import type { JavaScriptProjectSnapshot } from "./project-snapshot.js";
import { createSourceUsageEvidence } from "./source-usage.js";
import { stableHash } from "./stable-id.js";
import { workspacePackages } from "./workspace.js";

export function packagePrefix(path: string): string {
  return `pkg-${stableHash(path)}-`;
}
export function packageEvidenceId(path: string): string {
  return packagePrefix(path) + "evidence-workspace-manifest";
}

const referenceKeys = new Set(["evidenceIds", "factIds", "findingIds", "limitationIds"]);
function translateReferences(value: unknown, id: (id: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => translateReferences(item, id));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      referenceKeys.has(key) && Array.isArray(item)
        ? item.map((ref: string) => id(ref))
        : translateReferences(item, id),
    ]),
  );
}
function entity<T extends { readonly id: string }>(
  value: T,
  id: (id: string) => string,
  path: (path: string) => string,
): T {
  // The recursive mapper changes reference strings only; analyzer-core validates every emitted entity.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const mapped = translateReferences(value, id) as T & {
    subject?: { path?: string };
    location?: { path: string };
    paths?: string[];
  };
  const result = { ...mapped, id: id(value.id) };
  if (result.subject?.path !== undefined)
    result.subject = { ...result.subject, path: path(result.subject.path) };
  if (result.location !== undefined)
    result.location = { ...result.location, path: path(result.location.path) };
  if (result.paths !== undefined) result.paths = result.paths.map(path);
  return result;
}

type LocalContext = {
  readonly project: DeepReadonly<JavaScriptProjectSnapshot>;
  readonly evidence: readonly Evidence[];
  readonly limitations: readonly AnalysisLimitation[];
  readonly facts?: readonly AnalysisFact[];
  readonly findings?: readonly Finding[];
};
function packageContext<T extends LocalContext>(
  context: T,
  project: DeepReadonly<JavaScriptProjectSnapshot>,
): T {
  const path = project.packagePath ?? ".";
  const prefix = packagePrefix(path);
  const unmapId = (id: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : id);
  const unmapPath = (value: string) =>
    path !== "." && value.startsWith(path + "/") ? value.slice(path.length + 1) : value;
  return {
    ...context,
    project,
    evidence: context.evidence
      .filter((item) => item.kind === "external" || item.id.startsWith(prefix))
      .map((item) => entity(item, unmapId, unmapPath)),
    limitations: context.limitations
      .filter((item) => !item.id.startsWith("pkg-") || item.id.startsWith(prefix))
      .map((item) => entity(item, unmapId, unmapPath)),
    ...(context.facts === undefined
      ? {}
      : {
          facts: context.facts
            .filter((item) => item.id.startsWith(prefix))
            .map((item) => entity(item, unmapId, unmapPath)),
        }),
    ...(context.findings === undefined
      ? {}
      : {
          findings: context.findings
            .filter((item) => item.id.startsWith(prefix))
            .map((item) => entity(item, unmapId, unmapPath)),
        }),
  };
}
function outputMapper(context: LocalContext, project: DeepReadonly<JavaScriptProjectSnapshot>) {
  const path = project.packagePath ?? ".";
  const prefix = packagePrefix(path);
  const globalIds = new Set([
    ...context.evidence.filter((item) => item.kind === "external").map((item) => item.id),
    ...context.limitations.filter((item) => !item.id.startsWith("pkg-")).map((item) => item.id),
  ]);
  return <T extends { readonly id: string }>(value: T): T =>
    entity(
      value,
      (id) => (globalIds.has(id) ? id : prefix + id),
      (itemPath) =>
        path === "." || isSupportedLockfilePath(itemPath)
          ? itemPath
          : itemPath === "."
            ? path
            : path + "/" + itemPath,
    );
}

export function scopeFactRule(
  rule: FactRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>,
): FactRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata> {
  return {
    ...rule,
    evaluate(context) {
      if (context.project.workspacePackages === undefined) return rule.evaluate(context);
      const facts: AnalysisFact[] = [];
      const limitations: AnalysisLimitation[] = [];
      for (const project of workspacePackages(context.project)) {
        const result = rule.evaluate(packageContext(context, project));
        const map = outputMapper(context, project);
        facts.push(
          ...(result.facts ?? []).map((fact) => ({
            ...map(fact),
            ...(fact.details?.kind === "dependency_inventory"
              ? { details: { ...fact.details, packagePath: project.packagePath ?? "." } }
              : {}),
          })),
        );
        limitations.push(
          ...(result.limitations ?? []).map((item) => ({
            ...map(item),
            packagePaths: [project.packagePath ?? "."],
          })),
        );
      }
      return { facts, limitations };
    },
  };
}
export function scopeFindingRule(
  rule: FindingRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>,
): FindingRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata> {
  return {
    ...rule,
    evaluate(context) {
      if (context.project.workspacePackages === undefined) return rule.evaluate(context);
      const results = workspacePackages(context.project).map((project) => {
        const local = packageContext(context, project);
        // Peer constraints and internal links remain inventory facts, but are not registry installations.
        const facts = local.facts.filter(
          (fact) =>
            fact.details?.kind !== "dependency_inventory" ||
            !project.dependencies.some(
              (declaration) =>
                declaration.name === fact.subject.name &&
                declaration.group ===
                  (fact.details?.kind === "dependency_inventory"
                    ? fact.details.dependencyGroup
                    : "") &&
                (declaration.peerOnly ||
                  declaration.internalPackagePath !== undefined ||
                  (declaration.effectiveSpecifier ?? declaration.declaredSpecifier).startsWith(
                    "workspace:",
                  )),
            ),
        );
        const result = rule.evaluate({ ...local, facts });
        const map = outputMapper(context, project);
        return {
          findings: (result.findings ?? []).map((finding) => ({
            ...map(finding),
            packagePath: project.packagePath ?? ".",
            disposition: (["JS-NPM-006", "JS-MIGRATION-014"].includes(finding.rule.id)
              ? "opportunity"
              : finding.classification === "heuristic"
                ? "advice"
                : "issue") as NonNullable<Finding["disposition"]>,
          })),
          limitations: (result.limitations ?? []).map((item) => ({
            ...map(item),
            packagePaths: [project.packagePath ?? "."],
          })),
        };
      });
      return {
        findings: results.flatMap((result) => result.findings),
        limitations: results.flatMap((result) => result.limitations),
      };
    },
  };
}
export function scopeRecommendationRule(
  rule: RecommendationRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>,
): RecommendationRule<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata> {
  return {
    ...rule,
    evaluate(context) {
      if (context.project.workspacePackages === undefined) return rule.evaluate(context);
      const results = workspacePackages(context.project).map((project) => {
        const result = rule.evaluate(packageContext(context, project));
        const map = outputMapper(context, project);
        return {
          recommendations: (result.recommendations ?? []).map(map),
          limitations: (result.limitations ?? []).map((item) => ({
            ...map(item),
            packagePaths: [project.packagePath ?? "."],
          })),
        };
      });
      return {
        recommendations: results.flatMap((result) => result.recommendations),
        limitations: results.flatMap((result) => result.limitations),
      };
    },
  };
}

export function createWorkspaceEvidence(project: JavaScriptProjectSnapshot): ProjectEvidence[] {
  return workspacePackages(project).flatMap((member) => {
    const path = member.packagePath ?? ".";
    const prefix = packagePrefix(path);
    const evidence = [
      ...createDependencyInventoryEvidence(member),
      ...createProjectConfigurationEvidence(member),
      ...createReadinessEvidence(member),
      ...createSourceUsageEvidence(member),
      ...(member.resolvedDependencies === undefined
        ? []
        : createResolvedDependencyEvidence(member.resolvedDependencies)),
    ];
    return [
      {
        id: packageEvidenceId(path),
        kind: "project" as const,
        location: { path: path === "." ? "package.json" : path + "/package.json" },
        summary: `Workspace manifest at ${path === "." ? "package.json" : path + "/package.json"} was inspected statically.`,
      },
      ...evidence.map((item) =>
        entity(
          item,
          (id) => prefix + id,
          (value) =>
            path === "." ||
            item.id.startsWith("evidence-js-resolved-") ||
            item.id === "evidence-js-readiness-lockfile"
              ? value
              : value === "."
                ? path
                : path + "/" + value,
        ),
      ),
    ];
  });
}
