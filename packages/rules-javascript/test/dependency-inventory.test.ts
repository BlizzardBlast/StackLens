import { describe, expect, it } from "vitest";

import {
  createDependencyInventoryEvidence,
  dependencyInventoryRule,
} from "../src/dependency-inventory.js";
import { normalizePackageManifest } from "../src/manifest.js";
import { multiGroupManifest } from "./fixtures/manifests.js";

describe("dependencyInventoryRule [FR-005, FR-017]", () => {
  it("emits one structured fact per declaration with explicit project evidence", () => {
    const project = normalizePackageManifest(multiGroupManifest);
    const evidence = createDependencyInventoryEvidence(project);

    const result = dependencyInventoryRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "sha256:fixture",
      },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(result.facts).toHaveLength(project.dependencies.length);
    expect(evidence).toHaveLength(project.dependencies.length);

    expect(
      result.facts?.map((fact) => ({
        name: fact.subject.name,
        details: fact.details,
      })),
    ).toContainEqual({
      name: "react",
      details: {
        kind: "dependency_inventory",
        dependencyGroup: "peerDependencies",
        declaredSpecifier: ">=18 <20",
      },
    });

    expect(evidence.every((item) => item.location?.path === "package.json")).toBe(true);
    expect(
      evidence.every(
        (item) => item.location?.startLine === undefined && item.location?.endLine === undefined,
      ),
    ).toBe(true);
  });

  it("uses different deterministic IDs for the same package declared in different groups", () => {
    const project = normalizePackageManifest({
      dependencies: { shared: "^1.0.0" },
      peerDependencies: { shared: "^1.0.0" },
    });
    const evidence = createDependencyInventoryEvidence(project);
    const result = dependencyInventoryRule.evaluate({
      input: {
        type: "manifest",
        fingerprint: "sha256:fixture",
      },
      project,
      metadata: {},
      sources: [],
      evidence,
      limitations: [],
      partialFailures: [],
    });

    expect(new Set(evidence.map((item) => item.id)).size).toBe(2);
    expect(new Set((result.facts ?? []).map((fact) => fact.id)).size).toBe(2);
  });

  it("is deterministic for equivalent normalized input", () => {
    const project = normalizePackageManifest(multiGroupManifest);

    expect(createDependencyInventoryEvidence(project)).toEqual(
      createDependencyInventoryEvidence(project),
    );
  });
});
