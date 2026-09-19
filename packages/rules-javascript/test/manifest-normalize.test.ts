import { describe, expect, it } from "vitest";

import { normalizePackageManifest } from "../src/manifest.js";
import { multiGroupManifest } from "./fixtures/manifests.js";

describe("normalizePackageManifest [FR-004, FR-005]", () => {
  it("preserves runtime, development, peer, and optional dependency groups", () => {
    const result = normalizePackageManifest(multiGroupManifest);

    expect(result).toEqual({
      packageName: "fixture-app",
      dependencies: [
        {
          name: "@scope/runtime",
          declaredSpecifier: "workspace:^",
          group: "dependencies",
        },
        {
          name: "react",
          declaredSpecifier: "^19.0.0",
          group: "dependencies",
        },
        {
          name: "shared",
          declaredSpecifier: "file:../shared",
          group: "devDependencies",
        },
        {
          name: "vitest",
          declaredSpecifier: "^5.0.1",
          group: "devDependencies",
        },
        {
          name: "react",
          declaredSpecifier: ">=18 <20",
          group: "peerDependencies",
        },
        {
          name: "shared",
          declaredSpecifier: "latest",
          group: "peerDependencies",
        },
        {
          name: "sharp",
          declaredSpecifier: "https://example.com/sharp.tgz",
          group: "optionalDependencies",
        },
      ],
    });
  });

  it("keeps the same package in multiple groups as separate declarations", () => {
    const result = normalizePackageManifest({
      dependencies: { shared: "^1.0.0" },
      peerDependencies: { shared: ">=1" },
    });

    expect(result.dependencies).toEqual([
      {
        name: "shared",
        declaredSpecifier: "^1.0.0",
        group: "dependencies",
      },
      {
        name: "shared",
        declaredSpecifier: ">=1",
        group: "peerDependencies",
      },
    ]);
  });

  it("preserves supported complex specifiers exactly", () => {
    const specifier = "git+https://github.com/example/pkg.git#semver:^2.0.0";
    const result = normalizePackageManifest({
      dependencies: {
        "@scope/pkg": specifier,
      },
    });

    expect(result.dependencies[0]?.declaredSpecifier).toBe(specifier);
  });

  it("normalizes empty dependency groups to an empty inventory", () => {
    const result = normalizePackageManifest({
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    });

    expect(result.dependencies).toEqual([]);
  });

  it("rejects malformed dependency groups instead of reinterpreting them", () => {
    expect(() =>
      normalizePackageManifest({
        dependencies: ["react"],
      }),
    ).toThrow(/dependencies must be an object/);
  });

  it("rejects non-string dependency values instead of coercing them", () => {
    expect(() =>
      normalizePackageManifest({
        devDependencies: {
          vitest: 5,
        },
      }),
    ).toThrow(/devDependencies\.vitest must be a non-empty string/);
  });

  it("rejects dependency names that would otherwise be silently trimmed by the report contract", () => {
    expect(() =>
      normalizePackageManifest({
        dependencies: {
          " react ": "^19.0.0",
        },
      }),
    ).toThrow(/contains an invalid dependency name/);
  });

  it("rejects dependency specifiers that exceed the structured fact contract", () => {
    expect(() =>
      normalizePackageManifest({
        dependencies: {
          react: "x".repeat(2001),
        },
      }),
    ).toThrow(/at most 2000 characters/);
  });

  it("produces equivalent normalized output regardless of object insertion order", () => {
    const first = normalizePackageManifest({
      dependencies: {
        zeta: "^1.0.0",
        alpha: "^2.0.0",
      },
      devDependencies: {
        beta: "^3.0.0",
        alpha: "^4.0.0",
      },
    });
    const second = normalizePackageManifest({
      devDependencies: {
        alpha: "^4.0.0",
        beta: "^3.0.0",
      },
      dependencies: {
        alpha: "^2.0.0",
        zeta: "^1.0.0",
      },
    });

    expect(first).toEqual(second);
  });
});
