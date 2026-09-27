import { parse } from "@babel/parser";

import type { JavaScriptStaticProjectFile } from "./project-snapshot.js";
import { canonicalPath, isRecord, localPath } from "./static-data.js";

const UNKNOWN = Symbol("unresolved");
type Node = Record<string, unknown>;
export interface StaticConfigurationInspection {
  readonly value?: unknown;
  readonly partialReason?: string;
  readonly unresolvedFields: readonly string[];
  readonly provenance: readonly string[];
  readonly configuredPlugins: readonly string[];
}

function rootOf(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  if (node.type === "Identifier" && typeof node.name === "string") return node.name;
  return node.type === "MemberExpression" ? rootOf(node.object) : undefined;
}
function identifiers(node: unknown, result = new Set<string>(), depth = 0): Set<string> {
  if (depth > 64) return result;
  if (Array.isArray(node)) for (const child of node) identifiers(child, result, depth + 1);
  else if (isRecord(node)) {
    if (node.type === "Identifier" && typeof node.name === "string") result.add(node.name);
    for (const [key, child] of Object.entries(node))
      if (!["loc", "start", "end", "comments"].includes(key)) identifiers(child, result, depth + 1);
  }
  return result;
}

/** Resolve immutable syntax in already acquired files. Never load or execute modules. */
export function inspectStaticConfiguration(
  path: string,
  content: string,
  files: readonly JavaScriptStaticProjectFile[] = [],
): StaticConfigurationInspection {
  const tree = new Map(files.map((file) => [file.path, file.content]));
  tree.set(path, content);
  const visited = new Set<string>();
  const active = new Set<string>();
  const cache = new Map<string, Map<string, unknown>>();
  const opaque = new WeakSet<object>();
  const plugins = new Set<string>();
  const unknown = () => UNKNOWN;
  function resolve(from: string, specifier: string): string | undefined {
    const candidate = localPath(from, specifier);
    if (candidate === undefined) return undefined;
    return [
      candidate,
      ...[".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".json", "/index.ts", "/index.js"].map(
        (suffix) => candidate + suffix,
      ),
    ].find((item) => tree.has(item));
  }
  function merge(left: unknown, right: unknown, prefix = ""): unknown {
    if (left === UNKNOWN) {
      const unresolved: Node = { __proto__: null };
      opaque.add(unresolved);
      left = unresolved;
    }
    if (!isRecord(left) || !isRecord(right)) return unknown();
    const result: Node = Object.assign({ __proto__: null }, left);
    if (opaque.has(right)) {
      for (const key of Object.keys(result)) result[key] = UNKNOWN;
      opaque.add(result);
    } else if (opaque.has(left)) opaque.add(result);
    for (const [key, value] of Object.entries(right)) {
      if (value === null || value === undefined) continue;
      const old = Object.hasOwn(result, key) ? result[key] : opaque.has(left) ? UNKNOWN : undefined;
      const field = prefix ? prefix + "." + key : key;
      // These Vite fields have special semantics outside this supported merge subset.
      if (
        [
          "resolve.alias",
          "alias",
          "assetsInclude",
          "ssr.noExternal",
          "worker.plugins",
          "server.allowedHosts",
        ].includes(field) &&
        old !== undefined
      )
        result[key] = unknown();
      else if (value === UNKNOWN) result[key] = unknown();
      else if (old === UNKNOWN)
        result[key] = isRecord(value)
          ? merge(UNKNOWN, value, field)
          : Array.isArray(value)
            ? [unknown(), ...value]
            : value;
      else if (isRecord(old) && isRecord(value)) result[key] = merge(old, value, field);
      else if (Array.isArray(old) || Array.isArray(value))
        result[key] =
          old === undefined
            ? value
            : [...(Array.isArray(old) ? old : [old]), ...(Array.isArray(value) ? value : [value])];
      else result[key] = value;
    }
    return result;
  }
  function moduleExports(file: string, level: number): Map<string, unknown> {
    if (active.has(file) || level > 16 || !canonicalPath(file))
      return new Map([["default", unknown()]]);
    const cached = cache.get(file);
    if (cached !== undefined) return cached;
    if (visited.size >= 128) return new Map([["default", unknown()]]);
    visited.add(file);
    const source = tree.get(file);
    if (source === undefined || source.length > 512 * 1024)
      return new Map([["default", unknown()]]);
    if (file.endsWith(".json")) {
      try {
        const value: unknown = JSON.parse(source);
        return new Map([["default", value]]);
      } catch {
        return new Map([["default", unknown()]]);
      }
    }
    let body: readonly unknown[];
    try {
      body = parse(source, {
        sourceType: "unambiguous",
        sourceFilename: file,
        plugins: /\.[cm]?ts$/u.test(file) ? ["typescript"] : [],
        errorRecovery: false,
      }).program.body;
    } catch {
      return new Map([["default", unknown()]]);
    }
    active.add(file);
    const bindings = new Map<string, unknown>();
    const imports = new Map<string, { source: string; imported: string }>();
    const exports = new Map<string, unknown>();
    const helpers = new Map<string, Node>();
    const mutated = new Set<string>();
    let invalid = false;
    let commonJsExport: unknown;
    function declaration(statement: Node) {
      if (statement.type === "VariableDeclaration") {
        for (const item of Array.isArray(statement.declarations) ? statement.declarations : []) {
          if (
            isRecord(item) &&
            isRecord(item.id) &&
            item.id.type === "Identifier" &&
            typeof item.id.name === "string"
          ) {
            bindings.set(item.id.name, item.init);
            if (statement.kind !== "const") mutated.add(item.id.name);
          } else invalid = true;
        }
      } else if (
        statement.type === "FunctionDeclaration" &&
        isRecord(statement.id) &&
        typeof statement.id.name === "string"
      )
        helpers.set(statement.id.name, statement);
      else invalid = true;
    }
    for (const item of body) {
      if (!isRecord(item)) continue;
      if (
        item.type === "ImportDeclaration" &&
        isRecord(item.source) &&
        typeof item.source.value === "string"
      ) {
        for (const spec of Array.isArray(item.specifiers) ? item.specifiers : []) {
          if (!isRecord(spec) || !isRecord(spec.local) || typeof spec.local.name !== "string")
            continue;
          const imported =
            spec.type === "ImportDefaultSpecifier"
              ? "default"
              : isRecord(spec.imported)
                ? (spec.imported.name ?? spec.imported.value)
                : "*";
          if (typeof imported === "string")
            imports.set(spec.local.name, { source: item.source.value, imported });
        }
      } else if (item.type === "ExportDefaultDeclaration") exports.set("default", item.declaration);
      else if (item.type === "ExportNamedDeclaration" && isRecord(item.declaration)) {
        declaration(item.declaration);
        if (Array.isArray(item.declaration.declarations))
          for (const decl of item.declaration.declarations)
            if (isRecord(decl) && isRecord(decl.id) && typeof decl.id.name === "string")
              exports.set(decl.id.name, decl.id);
      } else if (
        item.type === "ExportNamedDeclaration" &&
        !item.source &&
        Array.isArray(item.specifiers)
      ) {
        for (const spec of item.specifiers)
          if (
            isRecord(spec) &&
            isRecord(spec.local) &&
            isRecord(spec.exported) &&
            typeof spec.exported.name === "string"
          )
            exports.set(spec.exported.name, spec.local);
      } else if (["VariableDeclaration", "FunctionDeclaration"].includes(String(item.type)))
        declaration(item);
      else if (item.type === "ExpressionStatement" && isRecord(item.expression)) {
        const expr = item.expression;
        const left = expr.left;
        if (
          expr.type === "AssignmentExpression" &&
          expr.operator === "=" &&
          isRecord(left) &&
          left.type === "MemberExpression" &&
          left.computed === false &&
          rootOf(left.object) === "module" &&
          isRecord(left.property) &&
          left.property.name === "exports" &&
          !exports.has("default")
        ) {
          exports.set("default", expr.right);
          commonJsExport = expr;
        }
      } else if (
        !["EmptyStatement", "TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(
          String(item.type),
        )
      )
        invalid = true;
    }
    const recognized = (name: string | undefined) => {
      const item = name === undefined ? undefined : imports.get(name);
      return (
        item !== undefined &&
        ["eslint/config", "vite", "vitest/config", "rollup", "@playwright/test"].includes(
          item.source,
        ) &&
        ["defineConfig", "mergeConfig"].includes(item.imported)
      );
    };
    let scanNodes = 0;
    function scan(node: unknown, depth = 0) {
      if (++scanNodes > 10000 || depth > 64) {
        invalid = true;
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node) scan(child, depth + 1);
        return;
      }
      if (
        !isRecord(node) ||
        ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(
          String(node.type),
        )
      )
        return;
      if (
        ["AssignmentExpression", "UpdateExpression"].includes(String(node.type)) ||
        (node.type === "UnaryExpression" && node.operator === "delete")
      ) {
        const name = rootOf(node.left ?? node.argument);
        if (name === "module" && node !== commonJsExport) invalid = true;
        if (name !== undefined && name !== "module") mutated.add(name);
        if (name !== "module" && (name === undefined || !bindings.has(name)))
          for (const ref of identifiers(node.right)) if (bindings.has(ref)) mutated.add(ref);
      }
      if (
        (node.type === "CallExpression" || node.type === "NewExpression") &&
        !recognized(rootOf(node.callee))
      ) {
        for (const name of identifiers(node.arguments))
          if (bindings.has(name) || imports.has(name)) mutated.add(name);
        const name = rootOf(node.callee);
        if (
          isRecord(node.callee) &&
          node.callee.type === "MemberExpression" &&
          name !== undefined &&
          (bindings.has(name) || imports.has(name))
        )
          mutated.add(name);
        if (name !== undefined && helpers.has(name))
          for (const captured of identifiers(helpers.get(name)?.body))
            if (bindings.has(captured)) mutated.add(captured);
        if (
          isRecord(node.callee) &&
          ["FunctionExpression", "ArrowFunctionExpression"].includes(String(node.callee.type))
        )
          for (const captured of identifiers(node.callee.body))
            if (bindings.has(captured)) mutated.add(captured);
      }
      for (const [key, child] of Object.entries(node))
        if (!["loc", "start", "end", "comments"].includes(key)) scan(child, depth + 1);
    }
    scan(body);
    // Aliases share object identity: mutation through either alias invalidates both.
    let changed = !invalid;
    while (changed) {
      changed = false;
      for (const [name, initializer] of bindings) {
        const refs = identifiers(initializer);
        if (mutated.has(name)) {
          for (const ref of refs)
            if ((bindings.has(ref) || imports.has(ref)) && !mutated.has(ref)) {
              mutated.add(ref);
              changed = true;
            }
        } else if ([...refs].some((ref) => mutated.has(ref))) {
          mutated.add(name);
          changed = true;
        }
      }
    }
    if (bindings.has("module") || imports.has("module")) invalid = true;
    let nodes = 0;
    const resolving = new Set<string>();
    function evaluate(node: unknown, depth = 0): unknown {
      if (++nodes > 10000 || depth > 64 || !isRecord(node)) return unknown();
      if (["StringLiteral", "BooleanLiteral", "NumericLiteral"].includes(String(node.type)))
        return node.value;
      if (node.type === "NullLiteral") return null;
      if (
        ["TSAsExpression", "TSSatisfiesExpression", "ParenthesizedExpression"].includes(
          String(node.type),
        )
      )
        return evaluate(node.expression, depth + 1);
      if (
        node.type === "UnaryExpression" &&
        node.operator === "-" &&
        isRecord(node.argument) &&
        node.argument.type === "NumericLiteral" &&
        typeof node.argument.value === "number"
      )
        return -node.argument.value;
      if (node.type === "Identifier" && typeof node.name === "string") {
        if (mutated.has(node.name) || resolving.has(node.name)) return unknown();
        const imported = imports.get(node.name);
        if (imported !== undefined) {
          const target = resolve(file, imported.source);
          if (target === undefined) return unknown();
          const values = moduleExports(target, level + 1);
          return imported.imported === "*"
            ? Object.fromEntries(values)
            : (values.get(imported.imported) ?? unknown());
        }
        if (!bindings.has(node.name)) return unknown();
        resolving.add(node.name);
        const value = evaluate(bindings.get(node.name), depth + 1);
        resolving.delete(node.name);
        return value;
      }
      if (node.type === "MemberExpression") {
        const value = evaluate(node.object, depth + 1);
        const key = node.computed
          ? evaluate(node.property, depth + 1)
          : isRecord(node.property)
            ? node.property.name
            : undefined;
        return isRecord(value) && typeof key === "string" && Object.hasOwn(value, key)
          ? value[key]
          : unknown();
      }
      if (node.type === "ArrayExpression" && Array.isArray(node.elements))
        return node.elements.flatMap((element) => {
          if (isRecord(element) && element.type === "SpreadElement") {
            const value = evaluate(element.argument, depth + 1);
            return Array.isArray(value) ? value : [unknown()];
          }
          return [evaluate(element, depth + 1)];
        });
      if (node.type === "ObjectExpression" && Array.isArray(node.properties)) {
        const value: Node = { __proto__: null };
        for (const property of node.properties) {
          if (!isRecord(property)) continue;
          if (property.type === "SpreadElement") {
            const spread = evaluate(property.argument, depth + 1);
            if (!isRecord(spread) || opaque.has(spread)) {
              for (const key of Object.keys(value)) value[key] = UNKNOWN;
              opaque.add(value);
              unknown();
            }
            if (isRecord(spread)) Object.assign(value, spread);
            continue;
          }
          const key = property.computed
            ? evaluate(property.key, depth + 1)
            : isRecord(property.key)
              ? (property.key.name ?? property.key.value)
              : undefined;
          if (typeof key !== "string") {
            for (const known of Object.keys(value)) value[known] = UNKNOWN;
            opaque.add(value);
            unknown();
            continue;
          }
          value[key] =
            property.type === "ObjectProperty" ? evaluate(property.value, depth + 1) : unknown();
        }
        return value;
      }
      if (
        node.type === "CallExpression" &&
        isRecord(node.callee) &&
        typeof node.callee.name === "string" &&
        Array.isArray(node.arguments)
      ) {
        const imported = imports.get(node.callee.name);
        if (
          imported !== undefined &&
          recognized(node.callee.name) &&
          !mutated.has(node.callee.name)
        ) {
          const values = node.arguments.map((argument) => evaluate(argument, depth + 1));
          if (imported.imported === "mergeConfig")
            return values.length >= 2 &&
              values.length <= 3 &&
              (values.length === 2 || typeof values[2] === "boolean")
              ? merge(values[0], values[1])
              : unknown();
          return imported.source === "eslint/config"
            ? values.flat(64)
            : values.length === 1
              ? values[0]
              : unknown();
        }
        if (
          imported !== undefined &&
          /^(?:@vitejs\/plugin-|@rollup\/plugin-|@tailwindcss\/vite$|rollup-plugin-|vite-plugin-|unplugin-)/u.test(
            imported.source,
          )
        )
          plugins.add(imported.source);
      }
      return unknown();
    }
    const values = new Map<string, unknown>();
    for (const [name, node] of exports) values.set(name, invalid ? unknown() : evaluate(node));
    active.delete(file);
    cache.set(file, values);
    return values;
  }
  const exportedValue = moduleExports(path, 0).get("default");
  const unresolvedFields: string[] = [];
  let cleanNodes = 0;
  function clean(value: unknown, field: string, depth = 0): unknown {
    if (++cleanNodes > 10000 || depth > 64) {
      unresolvedFields.push(field);
      return undefined;
    }
    if (value === UNKNOWN || value === undefined) {
      unresolvedFields.push(field);
      return undefined;
    }
    if (Array.isArray(value))
      return value.flatMap((item, index) => {
        const child = clean(item, field + "[" + index + "]", depth + 1);
        return child === undefined ? [] : [child];
      });
    if (isRecord(value)) {
      if (opaque.has(value)) unresolvedFields.push(field + ".*");
      return Object.fromEntries(
        Object.entries(value).flatMap(([key, item]) => {
          const child = clean(item, field + "." + key, depth + 1);
          return child === undefined ? [] : [[key, child]];
        }),
      );
    }
    return value;
  }
  const cleaned = clean(exportedValue, "$");
  const valid = isRecord(cleaned) || Array.isArray(cleaned);
  return {
    ...(valid ? { value: cleaned } : {}),
    ...(unresolvedFields.length > 0 || !valid
      ? {
          partialReason:
            content.length > 512 * 1024
              ? "Configuration exceeds the bounded static inspection size."
              : "Imported presets, runtime values, mutations, or unsupported expressions remain unresolved. Known fields were retained only where ordering and immutable syntax establish them.",
        }
      : {}),
    unresolvedFields: [...new Set(unresolvedFields)],
    provenance: [...visited].toSorted(),
    configuredPlugins: [...plugins].toSorted(),
  };
}
