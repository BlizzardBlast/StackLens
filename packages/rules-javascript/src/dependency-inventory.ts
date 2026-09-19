import type { FactRule } from "@stacklens/analyzer-core";
import type { AnalysisFact, ProjectEvidence } from "@stacklens/contracts";

import type { NormalizedDependencyDeclaration, NormalizedPackageManifest } from "./manifest.js";

import { stableHash } from "./stable-id.js";

function declarationIdentity(declaration: NormalizedDependencyDeclaration): string {
  return [declaration.group, declaration.name, declaration.declaredSpecifier].join("\u0000");
}

export function dependencyInventoryEvidenceId(
  declaration: NormalizedDependencyDeclaration,
): string {
  return `evidence-js-dependency-${stableHash(declarationIdentity(declaration))}`;
}

export function dependencyInventoryFactId(declaration: NormalizedDependencyDeclaration): string {
  return `fact-js-dependency-${stableHash(declarationIdentity(declaration))}`;
}

function describeDeclaration(declaration: NormalizedDependencyDeclaration): string {
  return `${declaration.name} is declared in ${declaration.group} as ${JSON.stringify(
    declaration.declaredSpecifier,
  )}.`;
}

export function createDependencyInventoryEvidence(
  manifest: NormalizedPackageManifest,
): ProjectEvidence[] {
  return manifest.dependencies.map((declaration) => ({
    id: dependencyInventoryEvidenceId(declaration),
    kind: "project",
    summary: describeDeclaration(declaration),
    location: {
      path: "package.json",
    },
  }));
}

function createDependencyInventoryFact(declaration: NormalizedDependencyDeclaration): AnalysisFact {
  return {
    id: dependencyInventoryFactId(declaration),
    type: "dependency.inventory",
    subject: {
      type: "dependency",
      name: declaration.name,
      path: "package.json",
    },
    statement: describeDeclaration(declaration),
    details: {
      kind: "dependency_inventory",
      dependencyGroup: declaration.group,
      declaredSpecifier: declaration.declaredSpecifier,
    },
    rule: {
      id: "JS-DEP-005",
      version: "1",
    },
    requirementIds: ["FR-005"],
    evidenceIds: [dependencyInventoryEvidenceId(declaration)],
  };
}

export const dependencyInventoryRule: FactRule<NormalizedPackageManifest, unknown> = {
  kind: "fact",
  id: "JS-DEP-005",
  version: "1",
  requirementIds: ["FR-005", "FR-017"],
  evaluate(context) {
    return {
      facts: context.project.dependencies.map(createDependencyInventoryFact),
    };
  },
};
