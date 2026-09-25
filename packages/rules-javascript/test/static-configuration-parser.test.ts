import { describe, expect, it } from "vitest";

import { inspectStaticConfiguration } from "../src/static-configuration-parser.js";

describe("bounded static configuration [FR-013, SEC-001, SEC-002]", () => {
  it.each([
    [
      'export default { rules: { semi: ["error", "always"] } };',
      { rules: { semi: ["error", "always"] } },
    ],
    [
      'const rules = { semi: "error" }; const config = [{ rules }]; export default config;',
      [{ rules: { semi: "error" } }],
    ],
    ['module.exports = { testEnvironment: "node" };', { testEnvironment: "node" }],
    [
      'import { defineConfig as config } from "eslint/config"; export default config([{ rules: { semi: "error" } }], [{ ignores: ["dist/**"] }]);',
      [{ rules: { semi: "error" } }, { ignores: ["dist/**"] }],
    ],
  ])("inspects supported literal exports without execution: %s", (content, value) => {
    expect(inspectStaticConfiguration("eslint.config.mjs", content)).toEqual({ value });
  });

  it("preserves observed literals while imported presets remain partial", () => {
    const result = inspectStaticConfiguration(
      "eslint.config.mjs",
      'import js from "@eslint/js"; export default [js.configs.recommended, { rules: { semi: "error" } }];',
    );
    expect(result.value).toEqual([{ rules: { semi: "error" } }]);
    expect(result.partialReason).toContain("Imported presets");
  });

  it.each([
    'export default (() => { throw new Error("never execute"); })();',
    "export default { rules: process.env.RULES };",
    "const config = {}; config.rules = loadRules(); export default config;",
    "let config = {}; export default config;",
    "const a = b; const b = a; export default a;",
    "const module = {}; module.exports = {};",
    'import { defineConfig } from "untrusted-package"; export default defineConfig({});',
    "export default { [getKey()]: true };",
    'export default { get rules() { return fetch("https://example.invalid"); } };',
    "export default {",
  ])("keeps unsupported expressions partial: %s", (content) => {
    expect(inspectStaticConfiguration("eslint.config.mjs", content).partialReason).toBeDefined();
  });

  it("bounds configuration size and nesting", () => {
    expect(
      inspectStaticConfiguration("eslint.config.mjs", " ".repeat(512 * 1024 + 1)).partialReason,
    ).toContain("size");
    expect(
      inspectStaticConfiguration(
        "eslint.config.mjs",
        `export default ${"[".repeat(100)}{}${"]".repeat(100)}`,
      ).partialReason,
    ).toBeDefined();
  });
});
