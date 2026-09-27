import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { isRecord } from "./static-data.js";

/** Parsing only: no compiler, user plugins, evaluation, or fenced example extraction. */
export function mdxExecutableSource(content: string): string {
  const tree: unknown = unified().use(remarkParse).use(remarkMdx).parse(content);
  const snippets: { line: number; code: string }[] = [];
  let nodes = 0;
  function walk(node: unknown, depth = 0) {
    if (++nodes > 10000 || depth > 64) throw new TypeError("MDX structure limit");
    if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1);
      return;
    }
    if (!isRecord(node)) return;
    if (
      [
        "mdxjsEsm",
        "mdxFlowExpression",
        "mdxTextExpression",
        "mdxJsxAttributeValueExpression",
        "mdxJsxExpressionAttribute",
      ].includes(String(node.type)) &&
      typeof node.value === "string"
    ) {
      const position = node.position;
      const line =
        isRecord(position) && isRecord(position.start) && typeof position.start.line === "number"
          ? position.start.line
          : 1;
      if (
        isRecord(node.data) &&
        isRecord(node.data.estree) &&
        Array.isArray(node.data.estree.body) &&
        node.data.estree.body.length === 0
      )
        return;
      if (node.value.trim())
        snippets.push({
          line,
          code:
            node.type === "mdxjsEsm"
              ? node.value
              : node.type === "mdxJsxExpressionAttribute"
                ? "void ({" + node.value + "});"
                : "void (" + node.value + ");",
        });
      return;
    }
    for (const key of ["children", "attributes", "value"])
      if (node[key] !== undefined) walk(node[key], depth + 1);
  }
  walk(tree);
  let source = "";
  let line = 1;
  for (const snippet of snippets.toSorted((a, b) => a.line - b.line)) {
    const gap = Math.max(0, snippet.line - line);
    source += "\n".repeat(gap) + snippet.code + ";";
    line += gap + snippet.code.split("\n").length - 1;
  }
  return source;
}
