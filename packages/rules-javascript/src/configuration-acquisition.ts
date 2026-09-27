import { parse } from "@babel/parser";

import { parseConfigurationJson } from "./json-configuration.js";
import type { JavaScriptStaticProjectFile } from "./project-snapshot.js";
import { canonicalPath, isRecord, localPath } from "./static-data.js";

/** A per-acquisition pure selector. Provider owns immutable paths, network and global budgets. */
export function createConfigurationPathSelector(): (
  files: readonly JavaScriptStaticProjectFile[],
  availablePaths: readonly string[],
) => readonly string[] {
  const processed = new Set<string>();
  const levels = new Map<string, number>();
  return (files, availablePaths) => {
    const available = new Set(availablePaths);
    const selected = new Set<string>();
    for (let round = 0; round <= 16; round += 1)
      for (const file of files) {
        if (processed.has(file.path) || file.content.length > 512 * 1024) continue;
        const initial = /(?:^|\/)(?:[^/]*config(?:\.[^/]+)?|biome)\.[cm]?[jt]s(?:on|onc)?$/u.test(
          file.path,
        );
        const level = levels.get(file.path) ?? (initial ? 0 : undefined);
        if (level === undefined || level >= 16 || processed.size >= 128) continue;
        processed.add(file.path);
        const specs: string[] = [];
        try {
          if (/\.jsonc?$/u.test(file.path)) {
            const value = parseConfigurationJson(file.content, true);
            if (isRecord(value)) {
              const bases = Array.isArray(value.extends) ? value.extends : [value.extends];
              for (const base of bases)
                if (typeof base === "string" && base.startsWith(".")) specs.push(base);
              for (const ref of Array.isArray(value.references) ? value.references : [])
                if (isRecord(ref) && typeof ref.path === "string")
                  specs.push(ref.path.startsWith(".") ? ref.path : "./" + ref.path);
            }
          } else {
            const ast = parse(file.content, {
              sourceType: "unambiguous",
              plugins: /\.[cm]?ts$/u.test(file.path) ? ["typescript"] : [],
            });
            for (const item of ast.program.body)
              if (item.type === "ImportDeclaration" && item.source.value.startsWith("."))
                specs.push(item.source.value);
          }
        } catch {
          continue;
        }
        for (const spec of specs) {
          const base = localPath(file.path, spec);
          if (base === undefined) continue;
          const target = [
            base,
            ...[
              ".json",
              ".ts",
              ".mts",
              ".cts",
              ".js",
              ".mjs",
              ".cjs",
              "/tsconfig.json",
              "/index.ts",
              "/index.js",
            ].map((suffix) => base + suffix),
          ].find((candidate) => canonicalPath(candidate) && available.has(candidate));
          if (target !== undefined && (levels.has(target) || levels.size < 128)) {
            levels.set(target, Math.min(levels.get(target) ?? 16, level + 1));
            selected.add(target);
          }
        }
      }
    return [...selected].toSorted();
  };
}
