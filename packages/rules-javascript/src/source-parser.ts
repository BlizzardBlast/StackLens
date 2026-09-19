import { parse } from "@babel/parser";

export const SUPPORTED_JAVASCRIPT_SOURCE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".cjs",
  ".mjs",
  ".ts",
  ".tsx",
  ".cts",
  ".mts",
] as const;

export type JavaScriptSourceReferenceKind =
  | "esm_import"
  | "esm_export"
  | "commonjs_require"
  | "dynamic_import";

export interface JavaScriptSourceReference {
  readonly kind: JavaScriptSourceReferenceKind;
  readonly specifier: string;
  readonly startLine?: number;
  readonly endLine?: number;
}

export interface JavaScriptSourceParseIssue {
  readonly kind: "parse_failure" | "dynamic_reference";
  readonly message: string;
  readonly line?: number;
}

export interface JavaScriptSourceParseResult {
  readonly references: readonly JavaScriptSourceReference[];
  readonly issues: readonly JavaScriptSourceParseIssue[];
}

export interface JavaScriptSourceReferenceParser {
  parse(path: string, content: string): JavaScriptSourceParseResult;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceExtension(path: string): string | undefined {
  const lowerPath = path.toLowerCase();
  return SUPPORTED_JAVASCRIPT_SOURCE_EXTENSIONS.find((extension) =>
    lowerPath.endsWith(extension),
  );
}

export function isSupportedJavaScriptSourcePath(path: string): boolean {
  return sourceExtension(path) !== undefined;
}

export function packageNameFromModuleSpecifier(specifier: string): string | undefined {
  if (
    specifier.length === 0 ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    specifier.startsWith("#") ||
    specifier.startsWith("node:") ||
    specifier.includes("\\")
  ) {
    return undefined;
  }

  for (let index = 0; index < specifier.length; index += 1) {
    const code = specifier.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return undefined;
    }
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(specifier)) {
    return undefined;
  }

  const segments = specifier.split("/");

  if (specifier.startsWith("@")) {
    return segments.length >= 2 && segments[0]!.length > 1 && segments[1]!.length > 0
      ? segments.slice(0, 2).join("/")
      : undefined;
  }

  return segments[0]?.length === 0 ? undefined : segments[0];
}

function staticString(node: unknown): string | undefined {
  if (!isRecord(node)) {
    return undefined;
  }

  if (node.type === "StringLiteral" && typeof node.value === "string") {
    return node.value;
  }

  return undefined;
}

function nodeLines(node: UnknownRecord): Pick<JavaScriptSourceReference, "startLine" | "endLine"> {
  const loc = node.loc;

  if (!isRecord(loc) || !isRecord(loc.start) || !isRecord(loc.end)) {
    return {};
  }

  const startLine = loc.start.line;
  const endLine = loc.end.line;

  if (
    typeof startLine !== "number" ||
    !Number.isInteger(startLine) ||
    startLine < 1 ||
    typeof endLine !== "number" ||
    !Number.isInteger(endLine) ||
    endLine < startLine
  ) {
    return {};
  }

  return { startLine, endLine };
}

function issueLine(node: UnknownRecord): number | undefined {
  const loc = node.loc;

  if (!isRecord(loc) || !isRecord(loc.start)) {
    return undefined;
  }

  const line = loc.start.line;
  return typeof line === "number" && Number.isInteger(line) && line > 0 ? line : undefined;
}

function createReference(
  node: UnknownRecord,
  kind: JavaScriptSourceReferenceKind,
  specifier: string,
): JavaScriptSourceReference {
  return {
    kind,
    specifier,
    ...nodeLines(node),
  };
}

function parserPlugins(path: string): ("typescript" | "jsx")[] {
  const extension = sourceExtension(path);
  const plugins: ("typescript" | "jsx")[] = [];

  if (
    extension === ".ts" ||
    extension === ".tsx" ||
    extension === ".cts" ||
    extension === ".mts"
  ) {
    plugins.push("typescript");
  }

  if (extension === ".jsx" || extension === ".tsx") {
    plugins.push("jsx");
  }

  return plugins;
}

function appendDynamicIssue(
  issues: JavaScriptSourceParseIssue[],
  node: UnknownRecord,
  message: string,
): void {
  const line = issueLine(node);
  issues.push({
    kind: "dynamic_reference",
    message,
    ...(line === undefined ? {} : { line }),
  });
}

function walkAst(
  value: unknown,
  references: JavaScriptSourceReference[],
  issues: JavaScriptSourceParseIssue[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      walkAst(item, references, issues);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const type = value.type;

  if (type === "ImportDeclaration") {
    const specifier = staticString(value.source);

    if (specifier !== undefined) {
      references.push(createReference(value, "esm_import", specifier));
    }
  } else if (type === "ExportNamedDeclaration" || type === "ExportAllDeclaration") {
    const specifier = staticString(value.source);

    if (specifier !== undefined) {
      references.push(createReference(value, "esm_export", specifier));
    }
  } else if (type === "ImportExpression") {
    const specifier = staticString(value.source);

    if (specifier === undefined) {
      appendDynamicIssue(issues, value, "Dynamic import() uses a non-static module specifier.");
    } else {
      references.push(createReference(value, "dynamic_import", specifier));
    }
  } else if (type === "CallExpression") {
    const callee = value.callee;
    const args = Array.isArray(value.arguments) ? value.arguments : [];
    const firstArgument = args[0];

    if (isRecord(callee) && callee.type === "Identifier" && callee.name === "require") {
      const specifier = staticString(firstArgument);

      if (specifier === undefined) {
        appendDynamicIssue(issues, value, "require() uses a non-static module specifier.");
      } else {
        references.push(createReference(value, "commonjs_require", specifier));
      }
    } else if (isRecord(callee) && callee.type === "Import") {
      const specifier = staticString(firstArgument);

      if (specifier === undefined) {
        appendDynamicIssue(issues, value, "Dynamic import() uses a non-static module specifier.");
      } else {
        references.push(createReference(value, "dynamic_import", specifier));
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (
      key === "loc" ||
      key === "start" ||
      key === "end" ||
      key === "extra" ||
      key === "errors" ||
      key === "comments" ||
      key === "tokens"
    ) {
      continue;
    }

    walkAst(child, references, issues);
  }
}

export const babelSourceReferenceParser: JavaScriptSourceReferenceParser = {
  parse(path, content) {
    if (!isSupportedJavaScriptSourcePath(path)) {
      return { references: [], issues: [] };
    }

    let ast;

    try {
      ast = parse(content, {
        sourceType: "unambiguous",
        sourceFilename: path,
        errorRecovery: false,
        createImportExpressions: true,
        plugins: parserPlugins(path),
      });
    } catch {
      return {
        references: [],
        issues: [
          {
            kind: "parse_failure",
            message: "The source file could not be parsed as supported JavaScript/TypeScript syntax.",
          },
        ],
      };
    }

    const references: JavaScriptSourceReference[] = [];
    const issues: JavaScriptSourceParseIssue[] = [];
    walkAst(ast, references, issues);

    return {
      references: references.toSorted((left, right) => {
        const specifierOrder = compareCodeUnits(left.specifier, right.specifier);

        if (specifierOrder !== 0) {
          return specifierOrder;
        }

        const kindOrder = compareCodeUnits(left.kind, right.kind);

        if (kindOrder !== 0) {
          return kindOrder;
        }

        return (left.startLine ?? 0) - (right.startLine ?? 0);
      }),
      issues,
    };
  },
};
