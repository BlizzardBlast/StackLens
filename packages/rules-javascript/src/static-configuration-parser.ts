import { parse } from "@babel/parser";

const UNKNOWN = Symbol("unresolved static configuration");
type Node = Record<string, unknown>;

function record(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface StaticConfigurationInspection {
  readonly value?: unknown;
  readonly partialReason?: string;
}

/** Only syntax is inspected. No bindings, presets, modules, or calls are executed. */
export function inspectStaticConfiguration(
  path: string,
  content: string,
): StaticConfigurationInspection {
  if (content.length > 512 * 1024) {
    return { partialReason: "Configuration exceeds the bounded static inspection size." };
  }
  let ast;
  try {
    ast = parse(content, {
      sourceType: "unambiguous",
      sourceFilename: path,
      plugins: /\.[cm]?ts$/u.test(path) ? ["typescript"] : [],
      errorRecovery: false,
    });
  } catch {
    return { partialReason: "Configuration could not be parsed as supported static syntax." };
  }
  const bindings = new Map<string, unknown>();
  const wrappers = new Map<string, boolean>();
  let exported: unknown = UNKNOWN;
  let partial = false;
  let unsafeStatement = false;
  for (const statement of ast.program.body as readonly unknown[]) {
    if (!record(statement)) continue;
    if (statement.type === "ImportDeclaration") {
      const source = record(statement.source) ? statement.source.value : undefined;
      for (const specifier of Array.isArray(statement.specifiers) ? statement.specifiers : []) {
        if (!record(specifier) || !record(specifier.local)) continue;
        const name = specifier.local.name;
        if (typeof name !== "string") continue;
        bindings.set(name, UNKNOWN);
        if (
          specifier.type === "ImportSpecifier" &&
          record(specifier.imported) &&
          specifier.imported.name === "defineConfig" &&
          (source === "eslint/config" || source === "vite" || source === "vitest/config")
        ) {
          wrappers.set(name, source === "eslint/config");
        }
      }
    } else if (statement.type === "VariableDeclaration" && statement.kind === "const") {
      for (const declaration of Array.isArray(statement.declarations)
        ? statement.declarations
        : []) {
        if (
          record(declaration) &&
          record(declaration.id) &&
          declaration.id.type === "Identifier" &&
          typeof declaration.id.name === "string"
        ) {
          bindings.set(declaration.id.name, declaration.init);
        } else unsafeStatement = true;
      }
    } else if (statement.type === "ExportDefaultDeclaration") {
      exported = statement.declaration;
    } else if (statement.type === "ExpressionStatement" && record(statement.expression)) {
      const expression = statement.expression;
      const left = expression.left;
      if (
        expression.type === "AssignmentExpression" &&
        expression.operator === "=" &&
        record(left) &&
        left.type === "MemberExpression" &&
        left.computed === false &&
        record(left.object) &&
        left.object.type === "Identifier" &&
        left.object.name === "module" &&
        record(left.property) &&
        left.property.name === "exports" &&
        exported === UNKNOWN
      )
        exported = expression.right;
      else unsafeStatement = true;
    } else if (statement.type !== "EmptyStatement") unsafeStatement = true;
  }
  if (unsafeStatement || bindings.has("module")) {
    return {
      partialReason:
        "Configuration contains statements or mutations outside the supported immutable export subset.",
    };
  }
  let nodes = 0;
  const resolving = new Set<string>();
  function unresolved(): typeof UNKNOWN {
    partial = true;
    return UNKNOWN;
  }
  function evaluate(node: unknown, depth = 0): unknown {
    nodes += 1;
    if (nodes > 10_000 || depth > 64 || !record(node)) return unresolved();
    if (
      node.type === "StringLiteral" ||
      node.type === "BooleanLiteral" ||
      node.type === "NumericLiteral"
    )
      return node.value;
    if (node.type === "NullLiteral") return null;
    if (
      node.type === "TSAsExpression" ||
      node.type === "TSSatisfiesExpression" ||
      node.type === "ParenthesizedExpression"
    )
      return evaluate(node.expression, depth + 1);
    if (
      node.type === "UnaryExpression" &&
      node.operator === "-" &&
      record(node.argument) &&
      node.argument.type === "NumericLiteral" &&
      typeof node.argument.value === "number"
    )
      return -node.argument.value;
    if (node.type === "Identifier" && typeof node.name === "string") {
      if (resolving.has(node.name) || !bindings.has(node.name)) return unresolved();
      resolving.add(node.name);
      const value = evaluate(bindings.get(node.name), depth + 1);
      resolving.delete(node.name);
      return value;
    }
    if (node.type === "ArrayExpression" && Array.isArray(node.elements)) {
      return node.elements.flatMap((element: unknown) => {
        if (record(element) && element.type === "SpreadElement") {
          const value = evaluate(element.argument, depth + 1);
          if (Array.isArray(value)) return value;
          unresolved();
          return [];
        }
        const value = evaluate(element, depth + 1);
        return value === UNKNOWN ? [] : [value];
      });
    }
    if (node.type === "ObjectExpression" && Array.isArray(node.properties)) {
      const entries = new Map<string, unknown>();
      for (const property of node.properties as readonly unknown[]) {
        if (!record(property)) {
          unresolved();
          continue;
        }
        if (property.type === "SpreadElement") {
          const value = evaluate(property.argument, depth + 1);
          if (record(value)) Object.entries(value).forEach(([key, item]) => entries.set(key, item));
          else unresolved();
          continue;
        }
        if (property.type !== "ObjectProperty" || property.computed || !record(property.key)) {
          unresolved();
          continue;
        }
        const key = property.key.type === "Identifier" ? property.key.name : property.key.value;
        if (typeof key !== "string") {
          unresolved();
          continue;
        }
        const value = evaluate(property.value, depth + 1);
        if (value === UNKNOWN) entries.delete(key);
        else entries.set(key, value);
      }
      return Object.fromEntries(entries);
    }
    if (
      node.type === "CallExpression" &&
      record(node.callee) &&
      node.callee.type === "Identifier" &&
      typeof node.callee.name === "string" &&
      wrappers.has(node.callee.name) &&
      Array.isArray(node.arguments)
    ) {
      const values = node.arguments.map((argument: unknown) => evaluate(argument, depth + 1));
      return wrappers.get(node.callee.name)
        ? values.filter((value: unknown) => value !== UNKNOWN).flat(64)
        : values[0];
    }
    return unresolved();
  }
  // Unused initializers can still mutate exported data at runtime; reject unsupported ones too.
  for (const [name, initializer] of bindings) {
    if (initializer !== UNKNOWN && !wrappers.has(name)) evaluate(initializer);
  }
  const value = evaluate(exported);
  const validRoot = record(value) || (Array.isArray(value) && value.every(record));
  return {
    ...(validRoot ? { value } : {}),
    ...(partial || !validRoot
      ? {
          partialReason:
            "Imported presets, runtime values, calls, or unsupported expressions remain unresolved; only literal configuration structure was inspected.",
        }
      : {}),
  };
}
