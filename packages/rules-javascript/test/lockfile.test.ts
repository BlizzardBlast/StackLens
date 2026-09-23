import { describe, expect, it } from "vitest";

import {
  createResolvedDependencyEvidence,
  normalizePackageManifest,
  normalizeResolvedDependencies,
  resolvedDependency,
} from "../src/index.js";

describe("resolved lockfile evidence [FR-023, FR-017, SCORE-003]", () => {
  it("normalizes package-lock.json direct resolutions only when root specifiers match", () => {
    const manifest = normalizePackageManifest({
      packageManager: "npm@11.0.0",
      dependencies: {
        react: "^19.0.0",
      },
      devDependencies: {
        typescript: "~6.0.3",
      },
    });
    const content = JSON.stringify({
      name: "demo",
      lockfileVersion: 3,
      packages: {
        "": {
          dependencies: {
            react: "^19.0.0",
          },
          devDependencies: {
            typescript: "~6.0.3",
          },
        },
        "node_modules/react": {
          version: "19.2.3",
        },
        "node_modules/typescript": {
          version: "6.0.3",
        },
      },
    });

    const result = normalizeResolvedDependencies(manifest, [
      { path: "package-lock.json", content },
    ]);

    expect(result.issues).toEqual([]);
    expect(result.snapshot).toMatchObject({
      path: "package-lock.json",
      packageManager: "npm",
      resolutions: [
        {
          packageName: "react",
          declaredSpecifier: "^19.0.0",
          version: "19.2.3",
        },
        {
          packageName: "typescript",
          declaredSpecifier: "~6.0.3",
          version: "6.0.3",
        },
      ],
    });
    expect(createResolvedDependencyEvidence(result.snapshot!)).toEqual([
      expect.objectContaining({
        kind: "project",
        location: { path: "package-lock.json" },
      }),
      expect.objectContaining({
        kind: "project",
        location: { path: "package-lock.json" },
      }),
    ]);
  });

  it("normalizes modern pnpm root-importer resolutions including peer suffixes", () => {
    const manifest = normalizePackageManifest({
      packageManager: "pnpm@11.20.0",
      dependencies: {
        "@sentry/react-native": "^8.25.0",
        expo: "~57.0.23",
      },
      devDependencies: {
        typescript: "~6.0.3",
      },
    });
    const content = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      '@sentry/react-native':
        specifier: ^8.25.0
        version: 8.25.0(react-native@0.86.3)
      expo:
        specifier: ~57.0.23
        version: 57.0.23(@babel/core@7.28.5)
    devDependencies:
      typescript:
        specifier: ~6.0.3
        version: 6.0.3
packages: {}
`;

    const result = normalizeResolvedDependencies(manifest, [{ path: "pnpm-lock.yaml", content }]);

    expect(result.issues).toEqual([]);
    expect(result.snapshot?.resolutions).toEqual([
      {
        packageName: "@sentry/react-native",
        declaredSpecifier: "^8.25.0",
        version: "8.25.0",
      },
      {
        packageName: "expo",
        declaredSpecifier: "~57.0.23",
        version: "57.0.23",
      },
      {
        packageName: "typescript",
        declaredSpecifier: "~6.0.3",
        version: "6.0.3",
      },
    ]);
  });

  it("normalizes Yarn classic and Berry selectors against declared specifiers", () => {
    const manifest = normalizePackageManifest({
      packageManager: "yarn@4.10.0",
      dependencies: {
        react: "^19.0.0",
        zod: "4.6.2",
      },
    });
    const content = `__metadata:
  version: 8

"react@npm:^19.0.0":
  version: 19.2.3

"zod@4.6.2":
  version "4.6.2"
`;

    const result = normalizeResolvedDependencies(manifest, [{ path: "yarn.lock", content }]);

    expect(result.issues).toEqual([]);
    expect(result.snapshot?.resolutions).toEqual([
      {
        packageName: "react",
        declaredSpecifier: "^19.0.0",
        version: "19.2.3",
      },
      {
        packageName: "zod",
        declaredSpecifier: "4.6.2",
        version: "4.6.2",
      },
    ]);
  });

  it("fails closed for stale specifiers, workspace targets, and ambiguous lockfiles", () => {
    const manifest = normalizePackageManifest({
      dependencies: {
        react: "^19.0.0",
        workspacepkg: "workspace:*",
      },
    });
    const packageLock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": {
          dependencies: {
            react: "^18.0.0",
            workspacepkg: "workspace:*",
          },
        },
        "node_modules/react": {
          version: "19.2.3",
        },
        "node_modules/workspacepkg": {
          version: "file:packages/workspacepkg",
        },
      },
    });

    const parsed = normalizeResolvedDependencies(manifest, [
      { path: "package-lock.json", content: packageLock },
    ]);

    expect(parsed.snapshot?.resolutions).toEqual([]);
    expect(parsed.issues.map((item) => item.code)).toEqual([
      "lockfile_specifier_mismatch",
      "lockfile_resolution_non_semver",
    ]);

    const ambiguous = normalizeResolvedDependencies(manifest, [
      { path: "package-lock.json", content: packageLock },
      { path: "yarn.lock", content: '"react@^19.0.0":\n  version "19.2.3"\n' },
    ]);

    expect(ambiguous.snapshot).toBeUndefined();
    expect(ambiguous.issues).toEqual([
      expect.objectContaining({
        code: "lockfile_multiple",
      }),
    ]);
  });

  it("uses packageManager to select one lockfile when several are committed", () => {
    const manifest = normalizePackageManifest({
      packageManager: "pnpm@11.20.0",
      dependencies: {
        react: "^19.0.0",
      },
    });
    const result = normalizeResolvedDependencies(manifest, [
      {
        path: "package-lock.json",
        content: "{}",
      },
      {
        path: "pnpm-lock.yaml",
        content: `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      react:
        specifier: ^19.0.0
        version: 19.2.3
`,
      },
    ]);

    expect(result.issues).toEqual([]);
    expect(resolvedDependency(result.snapshot, "react", "^19.0.0")).toEqual({
      packageName: "react",
      declaredSpecifier: "^19.0.0",
      version: "19.2.3",
    });
  });
});
