import type { FactRule } from "@stacklens/analyzer-core";
import type { AnalysisFact } from "@stacklens/contracts";

import { dependencyInventoryEvidenceId } from "./dependency-inventory.js";
import type { NormalizedDependencyDeclaration, NormalizedPackageManifest } from "./manifest.js";
import { compareCodeUnits, truncate, uniqueSorted } from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-TOOL-012";
const RULE_VERSION = "1";

interface ToolDescriptor {
  readonly packageName: string;
  readonly displayName: string;
  readonly role: string;
  readonly roleLabel: string;
}

const TOOL_DESCRIPTORS: readonly ToolDescriptor[] = [
  { packageName: "@angular/core", displayName: "Angular", role: "framework", roleLabel: "framework" },
  {
    packageName: "@biomejs/biome",
    displayName: "Biome",
    role: "linter_formatter",
    roleLabel: "linter/formatter",
  },
  {
    packageName: "@playwright/test",
    displayName: "Playwright",
    role: "test_framework",
    roleLabel: "test framework",
  },
  {
    packageName: "@reduxjs/toolkit",
    displayName: "Redux Toolkit",
    role: "state_management",
    roleLabel: "state-management library",
  },
  {
    packageName: "@sentry/node",
    displayName: "Sentry for Node.js",
    role: "observability",
    roleLabel: "observability tool",
  },
  {
    packageName: "@sentry/react",
    displayName: "Sentry for React",
    role: "observability",
    roleLabel: "observability tool",
  },
  {
    packageName: "@sveltejs/kit",
    displayName: "SvelteKit",
    role: "framework",
    roleLabel: "framework",
  },
  { packageName: "cypress", displayName: "Cypress", role: "test_framework", roleLabel: "test framework" },
  {
    packageName: "dd-trace",
    displayName: "Datadog tracing",
    role: "observability",
    roleLabel: "observability tool",
  },
  {
    packageName: "elastic-apm-node",
    displayName: "Elastic APM for Node.js",
    role: "observability",
    roleLabel: "observability tool",
  },
  { packageName: "esbuild", displayName: "esbuild", role: "build_tool", roleLabel: "build tool" },
  { packageName: "eslint", displayName: "ESLint", role: "linter", roleLabel: "linter" },
  { packageName: "jest", displayName: "Jest", role: "test_framework", roleLabel: "test framework" },
  {
    packageName: "jotai",
    displayName: "Jotai",
    role: "state_management",
    roleLabel: "state-management library",
  },
  { packageName: "mobx", displayName: "MobX", role: "state_management", roleLabel: "state-management library" },
  { packageName: "next", displayName: "Next.js", role: "framework", roleLabel: "framework" },
  { packageName: "nuxt", displayName: "Nuxt", role: "framework", roleLabel: "framework" },
  { packageName: "prettier", displayName: "Prettier", role: "formatter", roleLabel: "formatter" },
  { packageName: "rollup", displayName: "Rollup", role: "build_tool", roleLabel: "build tool" },
  {
    packageName: "typescript",
    displayName: "TypeScript",
    role: "language_tool",
    roleLabel: "language tool",
  },
  { packageName: "vite", displayName: "Vite", role: "build_tool", roleLabel: "build tool" },
  { packageName: "vitest", displayName: "Vitest", role: "test_framework", roleLabel: "test framework" },
  { packageName: "webpack", displayName: "webpack", role: "build_tool", roleLabel: "build tool" },
  {
    packageName: "zustand",
    displayName: "Zustand",
    role: "state_management",
    roleLabel: "state-management library",
  },
].toSorted((left, right) => compareCodeUnits(left.packageName, right.packageName));

function declarationsByPackage(
  project: NormalizedPackageManifest,
): ReadonlyMap<string, readonly NormalizedDependencyDeclaration[]> {
  const grouped = new Map<string, NormalizedDependencyDeclaration[]>();

  for (const declaration of project.dependencies) {
    const existing = grouped.get(declaration.name) ?? [];
    existing.push(declaration);
    grouped.set(declaration.name, existing);
  }

  return new Map(
    [...grouped.entries()].map(([packageName, declarations]) => [
      packageName,
      declarations.toSorted((left, right) => {
        const groupOrder = compareCodeUnits(left.group, right.group);
        return groupOrder === 0
          ? compareCodeUnits(left.declaredSpecifier, right.declaredSpecifier)
          : groupOrder;
      }),
    ]),
  );
}

export function frameworkToolDetectionFactId(packageName: string, role: string): string {
  return `fact-js-tool-${stableHash(JSON.stringify([packageName, role]))}`;
}

function createFact(
  descriptor: ToolDescriptor,
  declarations: readonly NormalizedDependencyDeclaration[],
): AnalysisFact {
  const groups = uniqueSorted(declarations.map((declaration) => declaration.group));
  const evidenceIds = uniqueSorted(declarations.map(dependencyInventoryEvidenceId));

  return {
    id: frameworkToolDetectionFactId(descriptor.packageName, descriptor.role),
    type: `project.tool.${descriptor.role}`,
    subject: {
      type: "tool",
      name: descriptor.displayName,
      path: "package.json",
    },
    statement: truncate(
      `Detected ${descriptor.displayName} as a supported ${descriptor.roleLabel} because ${descriptor.packageName} is declared in ${groups.join(", ")}.`,
      4_000,
    ),
    rule: {
      id: RULE_ID,
      version: RULE_VERSION,
    },
    requirementIds: ["FR-012"],
    evidenceIds: [...evidenceIds],
  };
}

export const frameworkToolDetectionRule: FactRule<NormalizedPackageManifest, unknown> = {
  kind: "fact",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: ["FR-012", "FR-017", "NFR-001", "NFR-002", "NFR-004", "NFR-005"],
  evaluate(context) {
    const byPackage = declarationsByPackage(context.project);
    const facts = TOOL_DESCRIPTORS.flatMap((descriptor) => {
      const declarations = byPackage.get(descriptor.packageName);
      return declarations === undefined ? [] : [createFact(descriptor, declarations)];
    });

    return {
      facts,
    };
  },
};
