import type { FactRule } from "@stacklens/analyzer-core";
import type { AnalysisFact, AnalysisLimitation, ProjectEvidence } from "@stacklens/contracts";

import type {
  JavaScriptPackageScript,
  JavaScriptProjectSnapshot,
  JavaScriptStaticProjectFile,
} from "./project-snapshot.js";
import { compareCodeUnits, truncate, uniqueSorted } from "./rule-support.js";
import {
  babelSourceReferenceParser,
  isSupportedJavaScriptSourcePath,
  packageNameFromModuleSpecifier,
} from "./source-parser.js";
import type {
  JavaScriptSourceReferenceKind,
  JavaScriptSourceReferenceParser,
} from "./source-parser.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-USAGE-009";
const RULE_VERSION = "1";

export type JavaScriptSourceAcquisitionCoverage = "complete" | "partial" | "unavailable";
export type JavaScriptDependencyReferenceKind =
  | JavaScriptSourceReferenceKind
  | "configuration_convention"
  | "package_script"
  | "configuration_plugin";

export interface JavaScriptDependencyReference {
  readonly packageName: string;
  readonly kind: JavaScriptDependencyReferenceKind;
  readonly path: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly detail?: string;
}

export interface JavaScriptSourceUsageIssue {
  readonly path?: string;
  readonly kind: "acquisition" | "parse_failure" | "dynamic_reference";
  readonly message: string;
  readonly line?: number;
}

export interface JavaScriptSourceUsageSnapshot {
  readonly coverage: JavaScriptSourceAcquisitionCoverage;
  readonly parsedSourceFiles: number;
  readonly references: readonly JavaScriptDependencyReference[];
  readonly issues: readonly JavaScriptSourceUsageIssue[];
}

const CONFIGURATION_CONVENTIONS = [
  { prefix: "biome.json", packageName: "@biomejs/biome" },
  { prefix: "eslint.config.", packageName: "eslint" },
  { prefix: ".eslintrc.", packageName: "eslint" },
  { prefix: "jest.config.", packageName: "jest" },
  { prefix: "next.config.", packageName: "next" },
  { prefix: "prettier.config.", packageName: "prettier" },
  { prefix: ".prettierrc", packageName: "prettier" },
  { prefix: "rollup.config.", packageName: "rollup" },
  { prefix: "tailwind.config.", packageName: "tailwindcss" },
  { prefix: "tsconfig", packageName: "typescript" },
  { prefix: "vite.config.", packageName: "vite" },
  { prefix: "vitest.config.", packageName: "vitest" },
  { prefix: "webpack.config.", packageName: "webpack" },
] as const;

const SCRIPT_EXECUTABLES: Readonly<Record<string, readonly string[]>> = {
  "@biomejs/biome": ["biome"],
  "@playwright/test": ["playwright"],
  "@sveltejs/kit": ["svelte-kit"],
  cypress: ["cypress"],
  esbuild: ["esbuild"],
  eslint: ["eslint"],
  jest: ["jest"],
  next: ["next"],
  nuxt: ["nuxt", "nuxi"],
  prettier: ["prettier"],
  rollup: ["rollup"],
  typescript: ["tsc"],
  vite: ["vite"],
  vitest: ["vitest"],
  webpack: ["webpack"],
};

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configurationConvention(
  file: JavaScriptStaticProjectFile,
): JavaScriptDependencyReference[] {
  const name = baseName(file.path);
  const descriptor = CONFIGURATION_CONVENTIONS.find(({ prefix }) => name.startsWith(prefix));

  if (descriptor === undefined) {
    return [];
  }

  return [
    {
      packageName: descriptor.packageName,
      kind: "configuration_convention",
      path: file.path,
      detail:
        "Recognized " +
        name +
        " as deterministic project configuration for " +
        descriptor.packageName +
        ".",
    },
  ];
}

function prettierPluginReferences(
  file: JavaScriptStaticProjectFile,
  issues: JavaScriptSourceUsageIssue[],
): JavaScriptDependencyReference[] {
  const name = baseName(file.path);

  if (name !== ".prettierrc" && name !== ".prettierrc.json") {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(file.content);
  } catch {
    issues.push({
      path: file.path,
      kind: "parse_failure",
      message: "Prettier plugin references could not be inspected because the configuration is not supported strict JSON.",
    });
    return [];
  }

  if (!isRecord(parsed)) {
    issues.push({
      path: file.path,
      kind: "parse_failure",
      message: "Prettier plugin references could not be inspected because the configuration root is not an object.",
    });
    return [];
  }

  const plugins = parsed.plugins;

  if (plugins === undefined) {
    return [];
  }

  if (!Array.isArray(plugins) || plugins.some((plugin) => typeof plugin !== "string")) {
    issues.push({
      path: file.path,
      kind: "parse_failure",
      message: "Prettier plugin references use an unsupported non-string plugin shape.",
    });
    return [];
  }

  return plugins.flatMap((plugin) => {
    if (typeof plugin !== "string") {
      return [];
    }

    const packageName = packageNameFromModuleSpecifier(plugin);

    if (packageName === undefined) {
      return [];
    }

    return [
      {
        packageName,
        kind: "configuration_plugin" as const,
        path: file.path,
        detail: "Prettier configuration statically references plugin " + plugin + ".",
      },
    ];
  });
}

function eslintPluginPackageName(pluginName: string): string | undefined {
  if (pluginName.length === 0 || pluginName.includes("/../")) {
    return undefined;
  }

  if (!pluginName.startsWith("@")) {
    return pluginName.startsWith("eslint-plugin-") ? pluginName : "eslint-plugin-" + pluginName;
  }

  const segments = pluginName.split("/");

  if (segments.length === 1) {
    return pluginName + "/eslint-plugin";
  }

  if (segments.length !== 2 || segments[0]!.length <= 1 || segments[1]!.length === 0) {
    return undefined;
  }

  return segments[1]!.startsWith("eslint-plugin-")
    ? pluginName
    : segments[0] + "/eslint-plugin-" + segments[1];
}

function eslintPluginReferences(
  file: JavaScriptStaticProjectFile,
  issues: JavaScriptSourceUsageIssue[],
): JavaScriptDependencyReference[] {
  if (baseName(file.path) !== ".eslintrc.json") {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(file.content);
  } catch {
    issues.push({
      path: file.path,
      kind: "parse_failure",
      message: "ESLint plugin references could not be inspected because the configuration is not valid strict JSON.",
    });
    return [];
  }

  if (!isRecord(parsed)) {
    issues.push({
      path: file.path,
      kind: "parse_failure",
      message: "ESLint plugin references could not be inspected because the configuration root is not an object.",
    });
    return [];
  }

  const pluginNames: string[] = [];
  const plugins = parsed.plugins;

  if (plugins !== undefined) {
    if (!Array.isArray(plugins) || plugins.some((plugin) => typeof plugin !== "string")) {
      issues.push({
        path: file.path,
        kind: "parse_failure",
        message: "ESLint plugin references use an unsupported plugins shape.",
      });
      return [];
    }

    pluginNames.push(...plugins.filter((plugin): plugin is string => typeof plugin === "string"));
  }

  const extensions =
    typeof parsed.extends === "string"
      ? [parsed.extends]
      : Array.isArray(parsed.extends) &&
          parsed.extends.every((entry) => typeof entry === "string")
        ? parsed.extends
        : parsed.extends === undefined
          ? []
          : undefined;

  if (extensions === undefined) {
    issues.push({
      path: file.path,
      kind: "parse_failure",
      message: "ESLint plugin references use an unsupported extends shape.",
    });
    return [];
  }

  for (const extension of extensions) {
    if (!extension.startsWith("plugin:")) {
      continue;
    }

    const pluginName = extension.slice("plugin:".length).split("/")[0];

    if (pluginName !== undefined && pluginName.length > 0) {
      pluginNames.push(pluginName);
    }
  }

  return [...new Set(pluginNames)].flatMap((pluginName) => {
    const packageName = eslintPluginPackageName(pluginName);

    if (packageName === undefined) {
      return [];
    }

    return [
      {
        packageName,
        kind: "configuration_plugin" as const,
        path: file.path,
        detail: "ESLint configuration statically references plugin " + pluginName + ".",
      },
    ];
  });
}

function commandTokens(command: string): readonly string[] {
  return command.split(/[\s;&|]+/).filter((token) => token.length > 0);
}

function scriptReferences(
  scripts: readonly JavaScriptPackageScript[],
  declaredPackages: ReadonlySet<string>,
): JavaScriptDependencyReference[] {
  const references: JavaScriptDependencyReference[] = [];

  for (const script of scripts) {
    const tokens = new Set(commandTokens(script.command));

    for (const [packageName, executables] of Object.entries(SCRIPT_EXECUTABLES)) {
      if (
        !declaredPackages.has(packageName) ||
        !executables.some((executable) => tokens.has(executable))
      ) {
        continue;
      }

      references.push({
        packageName,
        kind: "package_script",
        path: "package.json",
        detail:
          "package.json script " +
          JSON.stringify(script.name) +
          " invokes a supported executable for " +
          packageName +
          ".",
      });
    }
  }

  return references;
}

function referenceOrder(
  left: JavaScriptDependencyReference,
  right: JavaScriptDependencyReference,
): number {
  return (
    compareCodeUnits(left.packageName, right.packageName) ||
    compareCodeUnits(left.path, right.path) ||
    compareCodeUnits(left.kind, right.kind) ||
    (left.startLine ?? 0) - (right.startLine ?? 0)
  );
}

export function createJavaScriptSourceUsageSnapshot(
  project: JavaScriptProjectSnapshot,
  acquisitionCoverage: JavaScriptSourceAcquisitionCoverage,
  parser: JavaScriptSourceReferenceParser = babelSourceReferenceParser,
): JavaScriptSourceUsageSnapshot {
  if (acquisitionCoverage === "unavailable") {
    return {
      coverage: "unavailable",
      parsedSourceFiles: 0,
      references: [],
      issues: [
        {
          kind: "acquisition",
          message: "Repository source acquisition was unavailable.",
        },
      ],
    };
  }

  const files = project.files ?? [];
  const references: JavaScriptDependencyReference[] = [];
  const issues: JavaScriptSourceUsageIssue[] = [];
  let parsedSourceFiles = 0;

  for (const file of files) {
    references.push(
      ...configurationConvention(file),
      ...prettierPluginReferences(file, issues),
      ...eslintPluginReferences(file, issues),
    );

    if (!isSupportedJavaScriptSourcePath(file.path)) {
      continue;
    }

    parsedSourceFiles += 1;
    const parsed = parser.parse(file.path, file.content);

    for (const sourceReference of parsed.references) {
      const packageName = packageNameFromModuleSpecifier(sourceReference.specifier);

      if (packageName === undefined) {
        continue;
      }

      references.push({
        packageName,
        kind: sourceReference.kind,
        path: file.path,
        ...(sourceReference.startLine === undefined
          ? {}
          : { startLine: sourceReference.startLine }),
        ...(sourceReference.endLine === undefined ? {} : { endLine: sourceReference.endLine }),
        detail:
          "Static " +
          sourceReference.kind.replaceAll("_", " ") +
          " reference to " +
          sourceReference.specifier +
          ".",
      });
    }

    issues.push(
      ...parsed.issues.map((issue) => ({
        path: file.path,
        kind: issue.kind,
        message: issue.message,
        ...(issue.line === undefined ? {} : { line: issue.line }),
      })),
    );
  }

  if (parsedSourceFiles === 0) {
    issues.push({
      kind: "acquisition",
      message:
        "No supported JavaScript/TypeScript source files were available, so source-level dependency non-use cannot be inferred.",
    });
  }

  const declaredPackages = new Set(project.dependencies.map((dependency) => dependency.name));
  references.push(...scriptReferences(project.scripts ?? [], declaredPackages));

  if (acquisitionCoverage === "partial") {
    issues.push({
      kind: "acquisition",
      message:
        "Repository source acquisition was partial, so absence of a static reference is not negative evidence.",
    });
  }

  return {
    coverage: acquisitionCoverage === "complete" && issues.length === 0 ? "complete" : "partial",
    parsedSourceFiles,
    references: references
      .filter((reference) => declaredPackages.has(reference.packageName))
      .toSorted(referenceOrder),
    issues,
  };
}

export function withJavaScriptSourceUsage(
  project: JavaScriptProjectSnapshot,
  acquisitionCoverage: JavaScriptSourceAcquisitionCoverage,
  parser: JavaScriptSourceReferenceParser = babelSourceReferenceParser,
): JavaScriptProjectSnapshot {
  return {
    ...project,
    sourceUsage: createJavaScriptSourceUsageSnapshot(project, acquisitionCoverage, parser),
  };
}

export function sourceUsageCoverageEvidenceId(snapshot: JavaScriptSourceUsageSnapshot): string {
  return (
    "evidence-js-source-coverage-" +
    stableHash(
      JSON.stringify([snapshot.coverage, snapshot.parsedSourceFiles, snapshot.issues.length]),
    )
  );
}

export function sourceUsageReferenceEvidenceId(reference: JavaScriptDependencyReference): string {
  return (
    "evidence-js-source-usage-" +
    stableHash(
      JSON.stringify([
        reference.packageName,
        reference.kind,
        reference.path,
        reference.startLine ?? null,
        reference.endLine ?? null,
        reference.detail ?? null,
      ]),
    )
  );
}

export function createSourceUsageEvidence(project: JavaScriptProjectSnapshot): ProjectEvidence[] {
  const snapshot = project.sourceUsage;

  if (snapshot === undefined) {
    return [];
  }

  const coverageEvidence: ProjectEvidence = {
    id: sourceUsageCoverageEvidenceId(snapshot),
    kind: "project",
    summary:
      "Static source usage coverage is " +
      snapshot.coverage +
      "; " +
      snapshot.parsedSourceFiles +
      " supported JavaScript/TypeScript source file(s) were parsed.",
  };

  const referenceEvidence = new Map<string, ProjectEvidence>();

  for (const reference of snapshot.references) {
    const id = sourceUsageReferenceEvidenceId(reference);

    if (referenceEvidence.has(id)) {
      continue;
    }

    referenceEvidence.set(id, {
      id,
      kind: "project",
      summary: truncate(
        reference.detail ??
          reference.packageName +
            " is statically referenced via " +
            reference.kind.replaceAll("_", " ") +
            ".",
        2_000,
      ),
      location: {
        path: reference.path,
        ...(reference.startLine === undefined ? {} : { startLine: reference.startLine }),
        ...(reference.endLine === undefined ? {} : { endLine: reference.endLine }),
      },
    });
  }

  return [
    coverageEvidence,
    ...[...referenceEvidence.values()].toSorted((left, right) =>
      compareCodeUnits(left.id, right.id),
    ),
  ];
}

export function sourceUsageFactId(packageName: string): string {
  return "fact-js-source-usage-" + stableHash(packageName);
}

function limitationId(code: string): string {
  return "limitation-js-source-usage-" + stableHash(code);
}

function coverageLimitation(
  snapshot: JavaScriptSourceUsageSnapshot,
): AnalysisLimitation | undefined {
  if (snapshot.coverage === "complete") {
    return undefined;
  }

  const issueSummary = snapshot.issues
    .slice(0, 5)
    .map((issue) => (issue.path === undefined ? "" : issue.path + ": ") + issue.message)
    .join(" ");

  return {
    id: limitationId("coverage:" + snapshot.coverage + ":" + issueSummary),
    kind: "insufficient_evidence",
    message: truncate(
      "Static source-usage coverage is " +
        snapshot.coverage +
        ". StackLens will not infer dependency non-use from missing references. " +
        issueSummary,
      4_000,
    ),
    affectedCategories: ["dependencies"],
    sourceIds: [],
    ruleIds: [RULE_ID],
  };
}

export const sourceUsageFactRule: FactRule<JavaScriptProjectSnapshot, unknown> = {
  kind: "fact",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-009",
    "FR-017",
    "DATA-003",
    "NFR-001",
    "NFR-002",
    "NFR-004",
    "SEC-001",
    "SEC-002",
  ],
  evaluate(context) {
    const snapshot = context.project.sourceUsage;

    if (snapshot === undefined) {
      return {
        limitations: [
          {
            id: limitationId("snapshot-unavailable"),
            kind: "insufficient_evidence",
            message:
              "Static source-usage analysis was not supplied for this project; dependency non-use cannot be inferred.",
            affectedCategories: ["dependencies"],
            sourceIds: [],
            ruleIds: [RULE_ID],
          },
        ],
      };
    }

    const grouped = new Map<string, JavaScriptDependencyReference[]>();

    for (const reference of snapshot.references) {
      const existing = grouped.get(reference.packageName) ?? [];
      existing.push(reference);
      grouped.set(reference.packageName, existing);
    }

    const facts: AnalysisFact[] = [...grouped.entries()]
      .toSorted(([left], [right]) => compareCodeUnits(left, right))
      .map(([packageName, references]) => ({
        id: sourceUsageFactId(packageName),
        type: "dependency.usage.static",
        subject: {
          type: "dependency",
          name: packageName,
        },
        statement: truncate(
          packageName +
            " has " +
            references.length +
            " supported static source/configuration/script usage reference(s).",
          4_000,
        ),
        rule: {
          id: RULE_ID,
          version: RULE_VERSION,
        },
        requirementIds: ["FR-009"],
        evidenceIds: [...uniqueSorted(references.map(sourceUsageReferenceEvidenceId))],
      }));

    const limitation = coverageLimitation(snapshot);

    return {
      facts,
      ...(limitation === undefined ? {} : { limitations: [limitation] }),
    };
  },
};
