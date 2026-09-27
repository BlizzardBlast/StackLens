import { parse, type ParseError } from "jsonc-parser";

import type { JavaScriptStaticProjectFile } from "./project-snapshot.js";
import type { StaticConfigurationInspection } from "./static-configuration-parser.js";
import { canonicalPath, isRecord, localPath } from "./static-data.js";

export function parseConfigurationJson(content: string, comments: boolean): unknown {
  if (content.length > 512 * 1024) throw new TypeError("Configuration size limit");
  const errors: ParseError[] = [];
  const value: unknown = comments
    ? parse(content, errors, { allowTrailingComma: true, disallowComments: false })
    : (JSON.parse(content) as unknown);
  if (errors.length > 0) throw new TypeError("Malformed configuration JSONC");
  const queue = [{ value, depth: 0 }];
  let count = 0;
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (++count > 10000 || current.depth > 64) throw new TypeError("Configuration structure limit");
    if (Array.isArray(current.value) || isRecord(current.value))
      for (const child of Object.values(current.value))
        queue.push({ value: child, depth: current.depth + 1 });
  }
  return value;
}

/** TypeScript extends inherits options; references identify other projects, not inherited options. */
export function inspectTypeScriptConfiguration(
  path: string,
  content: string,
  files: readonly JavaScriptStaticProjectFile[] = [],
): StaticConfigurationInspection {
  const tree = new Map(files.map((file) => [file.path, file.content]));
  tree.set(path, content);
  const active = new Set<string>();
  const visited = new Set<string>();
  const unresolved = new Set<string>();
  function resolve(from: string, specifier: string): string | undefined {
    const base = localPath(from, specifier.startsWith(".") ? specifier : "./" + specifier);
    if (base === undefined) return undefined;
    return [base, base + ".json", base + "/tsconfig.json"].find((candidate) => tree.has(candidate));
  }
  function inspect(file: string, level: number): Record<string, unknown> {
    if (!canonicalPath(file) || active.has(file) || level > 16 || visited.size >= 128) {
      unresolved.add("graph");
      return {};
    }
    active.add(file);
    visited.add(file);
    let parsed: unknown;
    try {
      parsed = parseConfigurationJson(tree.get(file) ?? "", true);
    } catch {
      unresolved.add(file + ":syntax");
      active.delete(file);
      return {};
    }
    if (!isRecord(parsed)) {
      unresolved.add(file + ":root");
      active.delete(file);
      return {};
    }
    let inherited: Record<string, unknown> = {};
    const bases =
      parsed.extends === undefined
        ? []
        : Array.isArray(parsed.extends)
          ? parsed.extends
          : [parsed.extends];
    for (const spec of bases) {
      const target =
        typeof spec === "string" && spec.startsWith(".") ? resolve(file, spec) : undefined;
      if (target === undefined) {
        inherited = {};
        unresolved.add(file + ":extends");
        continue;
      }
      const unresolvedBefore = unresolved.size;
      const base = inspect(target, level + 1);
      if (unresolved.size !== unresolvedBefore) inherited = {};
      inherited = {
        ...inherited,
        ...base,
        compilerOptions: {
          ...(isRecord(inherited.compilerOptions) ? inherited.compilerOptions : {}),
          ...(isRecord(base.compilerOptions) ? base.compilerOptions : {}),
        },
      };
    }
    if (parsed.references !== undefined) {
      if (!Array.isArray(parsed.references)) unresolved.add(file + ":references");
      else
        for (const ref of parsed.references) {
          const target =
            isRecord(ref) && typeof ref.path === "string" ? resolve(file, ref.path) : undefined;
          if (target === undefined) unresolved.add(file + ":references");
          else inspect(target, level + 1);
        }
    }
    active.delete(file);
    return {
      ...inherited,
      ...parsed,
      ...(isRecord(parsed.compilerOptions)
        ? {
            compilerOptions: {
              ...(isRecord(inherited.compilerOptions) ? inherited.compilerOptions : {}),
              ...parsed.compilerOptions,
            },
          }
        : {}),
    };
  }
  const value = inspect(path, 0);
  return {
    value,
    unresolvedFields: [...unresolved].toSorted(),
    provenance: [...visited].toSorted(),
    configuredPlugins: [],
    ...(unresolved.size === 0
      ? {}
      : {
          partialReason:
            "Some TypeScript configuration fields or local extends/references could not be resolved from the acquired tree.",
        }),
  };
}
