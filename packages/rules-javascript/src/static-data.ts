import { parseDocument } from "yaml";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStaticYaml(content: string): unknown {
  if (content.length > 512 * 1024) throw new TypeError("Static YAML exceeds the inspection bound");
  const document = parseDocument(content, { uniqueKeys: true, schema: "core" });
  if (document.errors.length > 0 || document.warnings.length > 0)
    throw new TypeError("Unsupported YAML structure");
  return document.toJS({ maxAliasCount: 0 }) as unknown;
}

export function canonicalPath(path: string): boolean {
  return (
    path.length > 0 &&
    path.length <= 1000 &&
    !path.startsWith("/") &&
    !hasUnsafePathCharacter(path) &&
    path.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export function localPath(from: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".") || hasUnsafePathCharacter(specifier)) return undefined;
  const segments = from.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else segments.push(part);
  }
  const path = segments.join("/");
  return canonicalPath(path) ? path : undefined;
}

function hasUnsafePathCharacter(value: string): boolean {
  for (const char of value)
    if (char === "\\" || char === ":" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
      return true;
  return false;
}
