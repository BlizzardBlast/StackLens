import { describe, expect, it } from "vitest";

import { createConfigurationPathSelector } from "../src/configuration-acquisition.js";
import {
  inspectTypeScriptConfiguration,
  parseConfigurationJson,
} from "../src/json-configuration.js";
import { inspectStaticConfiguration as inspect } from "../src/static-configuration-parser.js";

describe("FR-013 field-level immutable configuration resolution", () => {
  it("resolves local immutable aliases, named exports and property access", () => {
    const result = inspect(
      "vite.config.ts",
      "import { settings } from './config/base'; export default { ...settings, mode: 'production' };",
      [
        {
          path: "config/base.ts",
          content: "const nested = { strict: true }; export const settings = { test: nested };",
        },
      ],
    );
    expect(result.value).toEqual({ test: { strict: true }, mode: "production" });
    expect(result.partialReason).toBeUndefined();
    expect(result.provenance).toEqual(["config/base.ts", "vite.config.ts"]);
  });
  it("honors unknown spread ordering and later literal restoration", () => {
    const result = inspect(
      "eslint.config.mjs",
      "import preset from 'preset'; const config = { strict: true, ...preset, files: ['src/**'] }; export default config;",
    );
    expect(result.value).toEqual({ files: ["src/**"] });
    expect(result.unresolvedFields).toContain("$.strict");
    expect(
      inspect(
        "eslint.config.mjs",
        "import preset from 'preset'; export default {...preset, strict:true};",
      ).value,
    ).toEqual({ strict: true });
  });
  it("retains KerjaLog literal settings alongside opaque React Hooks preset fields", () => {
    const result = inspect(
      "eslint.config.mjs",
      "import reactHooks from 'eslint-plugin-react-hooks'; const recommended = reactHooks.configs.flat.recommended; export default [{...recommended, files:['src/**/*.tsx'], languageOptions:{...recommended.languageOptions, parserOptions:{ecmaVersion:'latest'}}}];",
    );
    expect(result.value).toEqual([
      { files: ["src/**/*.tsx"], languageOptions: { parserOptions: { ecmaVersion: "latest" } } },
    ]);
    expect(result.partialReason).toBeDefined();
  });
  it("retains Frey-ui Vite plugins and Vitest literals despite opaque coverage defaults", () => {
    const result = inspect(
      "apps/storybook/vitest.config.ts",
      "import {defineConfig,mergeConfig,coverageConfigDefaults} from 'vitest/config'; import vite from './vite.config'; export default mergeConfig(vite,defineConfig({test:{globals:true,environment:'jsdom',coverage:{exclude:[...coverageConfigDefaults.exclude,'**/.storybook/**']}}}));",
      [
        {
          path: "apps/storybook/vite.config.ts",
          content:
            "import react from '@vitejs/plugin-react'; import tailwind from '@tailwindcss/vite'; import {defineConfig} from 'vite'; export default defineConfig({plugins:[react(),tailwind()]});",
        },
      ],
    );
    expect(result.value).toMatchObject({
      test: { globals: true, environment: "jsdom", coverage: { exclude: ["**/.storybook/**"] } },
    });
    expect(result.configuredPlugins).toEqual(["@tailwindcss/vite", "@vitejs/plugin-react"]);
    expect(result.unresolvedFields).toContain("$.test.coverage.exclude[0]");
  });
  it("uses Vite array concatenation and null skipping; unsupported special merges remain unknown", () => {
    const result = inspect(
      "vite.config.ts",
      "import {mergeConfig} from 'vite'; export default mergeConfig({test:{include:['a'],environment:'node'},resolve:{alias:{x:'a'}}},{test:{include:['b'],environment:null},resolve:{alias:{y:'b'}}});",
    );
    expect(result.value).toEqual({
      test: { include: ["a", "b"], environment: "node" },
      resolve: {},
    });
    expect(result.unresolvedFields).toContain("$.resolve.alias");
  });
  it("retains explicit primitive overrides of unknown merge defaults without inventing arrays", () => {
    const result = inspect(
      "vitest.config.ts",
      "import defaults from 'preset'; import {mergeConfig} from 'vitest/config'; export default mergeConfig(defaults,{test:{globals:true,include:['a']}});",
    );
    expect(result.value).toMatchObject({ test: { globals: true, include: ["a"] } });
    expect(result.unresolvedFields).toContain("$.test.include[0]");
  });
  it("permits uncalled Rollup helpers and records opaque callback output", () => {
    const result = inspect(
      "rollup.config.mjs",
      "import {defineConfig} from 'rollup'; function helper() { throw new Error('EXECUTION_SENTINEL'); } export default defineConfig([{input:'src/index.ts',output:{format:'es'},plugins:[helper()]}]);",
    );
    expect(result.value).toEqual([
      { input: "src/index.ts", output: { format: "es" }, plugins: [] },
    ]);
    expect(result.unresolvedFields).toContain("$[0].plugins[0]");
  });
  it.each([
    "const config={strict:true}; const alias=config; alias.strict=false; export default config;",
    "const config={strict:true}; mutate(config); export default config;",
    "const config={strict:true}; function helper(){config.strict=false}; helper(); export default config;",
    "const config={strict:true}; (()=>{config.strict=false})(); export default config;",
    "const config={strict:true}; globalThis.escape=config; export default config;",
  ])("invalidates mutation or escape without executing: %s", (content) => {
    expect(inspect("vite.config.ts", content).value).toBeUndefined();
  });
  it("bounds local graphs, cycles, traversal and missing imports", () => {
    for (const source of ["./missing", "../outside", "./cycle"]) {
      const result = inspect(
        "vite.config.ts",
        "import base from '" + source + "'; export default base;",
        [{ path: "cycle.ts", content: "import base from './vite.config'; export default base;" }],
      );
      expect(result.value).toBeUndefined();
      expect(result.partialReason).toBeDefined();
    }
    const files = Array.from({ length: 20 }, (_, i) => ({
      path: "c" + i + ".ts",
      content: "import next from './c" + (i + 1) + "'; export default next;",
    }));
    expect(inspect("c0.ts", files[0]!.content, files).provenance.length).toBeLessThanOrEqual(17);
  });
  it("rejects imported object escapes, wrapper mutation, and changed CommonJS exports", () => {
    const files = [{ path: "base.ts", content: "export default {strict:true};" }];
    for (const content of [
      "import config from './base'; mutate(config); export default config;",
      "import {defineConfig} from 'vite'; defineConfig=custom; export default defineConfig({strict:true});",
      "const config={strict:true}; module.exports=config; module.exports.strict=false;",
      "module.exports={strict:true}; module.exports={strict:false};",
    ])
      expect(inspect("vite.config.ts", content, files).value).toBeUndefined();
  });
  it("discovers referenced JSON configs even when a shared module was acquired before its parent", () => {
    const selector = createConfigurationPathSelector();
    const files = [
      {
        path: "helper.ts",
        content: "import base from './shared/options.json'; export default base;",
      },
      { path: "vite.config.ts", content: "import base from './helper'; export default base;" },
      { path: "tsconfig.json", content: '{"extends":"./types/base"}' },
    ];
    expect(selector(files, ["helper.ts", "shared/options.json", "types/base.json"])).toEqual([
      "helper.ts",
      "shared/options.json",
      "types/base.json",
    ]);
    expect(
      selector([{ path: "tsconfig.json", content: '{"extends":"../../secret"}' }], ["secret.json"]),
    ).toEqual([]);
  });
});

describe("FR-013 JSONC TypeScript inheritance", () => {
  it("accepts comments/trailing commas, local extends and references", () => {
    const result = inspectTypeScriptConfiguration(
      "apps/web/tsconfig.json",
      '{"extends":"../../config/base","compilerOptions":{"strict":false,},"references":[{"path":"./node"}]}',
      [
        {
          path: "config/base.json",
          content: '{/*safe*/"compilerOptions":{"strict":true,"noEmit":true}}',
        },
        { path: "apps/web/node/tsconfig.json", content: '{"compilerOptions":{"composite":true}}' },
      ],
    );
    expect(result.value).toMatchObject({ compilerOptions: { strict: false, noEmit: true } });
    expect(result.partialReason).toBeUndefined();
    expect(result.provenance).toHaveLength(3);
  });
  it("rejects recovered malformed JSONC and keeps manifests strict", () => {
    expect(() => parseConfigurationJson('{"strict":true,,}', true)).toThrow(/Malformed/u);
    expect(() => parseConfigurationJson('{/*comment*/"name":"x"}', false)).toThrow(/JSON/u);
  });
  it("preserves explicit options with opaque external bases and detects reference cycles", () => {
    const external = inspectTypeScriptConfiguration(
      "tsconfig.json",
      '{"extends":"external/base","compilerOptions":{"strict":true}}',
    );
    expect(external.value).toMatchObject({ compilerOptions: { strict: true } });
    expect(external.partialReason).toBeDefined();
    expect(
      inspectTypeScriptConfiguration("tsconfig.json", '{"references":[{"path":"."}]}')
        .partialReason,
    ).toBeDefined();
  });
});
