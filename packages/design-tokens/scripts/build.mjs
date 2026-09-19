import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = path.resolve(packageRoot, "../..");
const sourcePath = path.join(repositoryRoot, "design/tokens/stacklens.tokens.json");
const distDirectory = path.join(packageRoot, "dist");
const checkOnly = process.argv.includes("--check");

function isToken(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "$type" in value &&
    "$value" in value
  );
}

function getToken(root, tokenPath) {
  let current = root;
  for (const part of tokenPath.split(".")) {
    current = current?.[part];
  }

  if (!isToken(current)) {
    throw new Error(`Unknown token reference: {${tokenPath}}`);
  }

  return current;
}

function componentToByte(component) {
  return Math.max(0, Math.min(255, Math.round(component * 255)));
}

function colorToHex(value) {
  if (value.colorSpace !== "srgb" || !Array.isArray(value.components)) {
    throw new Error("Only sRGB design-token colors are supported by the current generator.");
  }

  const rgb = value.components
    .slice(0, 3)
    .map((component) => componentToByte(component).toString(16).padStart(2, "0"))
    .join("");

  if (value.alpha === undefined || value.alpha === 1) {
    return `#${rgb}`;
  }

  return `#${rgb}${componentToByte(value.alpha).toString(16).padStart(2, "0")}`;
}

function resolveTokenValue(root, token, seen = new Set()) {
  const value = token.$value;

  if (typeof value === "string") {
    const match = /^\{(.+)\}$/.exec(value);
    if (match) {
      const reference = match[1];
      if (seen.has(reference)) {
        throw new Error(`Circular token reference: ${[...seen, reference].join(" -> ")}`);
      }

      const nextSeen = new Set(seen);
      nextSeen.add(reference);
      return resolveTokenValue(root, getToken(root, reference), nextSeen);
    }

    return value;
  }

  if (token.$type === "color") {
    return colorToHex(value);
  }

  if (token.$type === "dimension" || token.$type === "duration") {
    return `${value.value}${value.unit}`;
  }

  if (token.$type === "fontFamily") {
    return value
      .map((family) => (/^[a-zA-Z0-9-]+$/.test(family) ? family : JSON.stringify(family)))
      .join(", ");
  }

  if (typeof value === "number") {
    return String(value);
  }

  throw new Error(`Unsupported token value for type ${token.$type}`);
}

function flattenTokens(node, prefix = [], result = {}) {
  if (isToken(node)) {
    result[prefix.join(".")] = node;
    return result;
  }

  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("$")) continue;
      flattenTokens(value, [...prefix, key], result);
    }
  }

  return result;
}

function cssVariableName(tokenPath) {
  return `--sl-ref-${tokenPath.replaceAll(".", "-")}`;
}

function tokenValue(root, tokenPath) {
  return resolveTokenValue(root, getToken(root, tokenPath));
}

function createModeVariables(root, mode) {
  const semantic = {
    background: `color.semantic.${mode}.background`,
    surface: `color.semantic.${mode}.surface`,
    "surface-raised": `color.semantic.${mode}.surfaceRaised`,
    "surface-muted": `color.semantic.${mode}.surfaceMuted`,
    foreground: `color.semantic.${mode}.foreground`,
    "muted-foreground": `color.semantic.${mode}.mutedForeground`,
    border: `color.semantic.${mode}.border`,
    input: `color.semantic.${mode}.input`,
    primary: `color.semantic.${mode}.primary`,
    "primary-foreground": `color.semantic.${mode}.primaryForeground`,
    focus: `color.semantic.${mode}.focus`,
    danger: `color.semantic.${mode}.danger`,
    success: `color.semantic.${mode}.success`,
    warning: `color.semantic.${mode}.warning`,
    info: `color.semantic.${mode}.info`,
    "severity-critical": `color.domain.severity.${mode}.critical`,
    "severity-high": `color.domain.severity.${mode}.high`,
    "severity-medium": `color.domain.severity.${mode}.medium`,
    "severity-low": `color.domain.severity.${mode}.low`,
    "evidence-fact": `color.domain.evidence.${mode}.fact`,
    "evidence-heuristic": `color.domain.evidence.${mode}.heuristic`,
    "evidence-recommendation": `color.domain.evidence.${mode}.recommendation`,
    "confidence-high": `color.domain.confidence.${mode}.high`,
    "confidence-medium": `color.domain.confidence.${mode}.medium`,
    "confidence-low": `color.domain.confidence.${mode}.low`,
    "score-excellent": `color.domain.score.${mode}.excellent`,
    "score-good": `color.domain.score.${mode}.good`,
    "score-watch": `color.domain.score.${mode}.watch`,
    "score-poor": `color.domain.score.${mode}.poor`,
    "score-unknown": `color.domain.score.${mode}.unknown`,
  };

  return Object.entries(semantic)
    .map(([name, source]) => `  --sl-${name}: ${tokenValue(root, source)};`)
    .join("\n");
}

function createCompatibilityVariables() {
  return [
    "  --background: var(--sl-background);",
    "  --foreground: var(--sl-foreground);",
    "  --card: var(--sl-surface);",
    "  --card-foreground: var(--sl-foreground);",
    "  --popover: var(--sl-surface-raised);",
    "  --popover-foreground: var(--sl-foreground);",
    "  --primary: var(--sl-primary);",
    "  --primary-foreground: var(--sl-primary-foreground);",
    "  --secondary: var(--sl-surface-muted);",
    "  --secondary-foreground: var(--sl-foreground);",
    "  --muted: var(--sl-surface-muted);",
    "  --muted-foreground: var(--sl-muted-foreground);",
    "  --accent: var(--sl-surface-muted);",
    "  --accent-foreground: var(--sl-foreground);",
    "  --destructive: var(--sl-danger);",
    "  --border: var(--sl-border);",
    "  --input: var(--sl-input);",
    "  --ring: var(--sl-focus);",
    "  --radius: var(--sl-radius-surface);",
  ].join("\n");
}

function createThemeCss(root) {
  const flat = flattenTokens(root);
  const references = Object.entries(flat)
    .filter(
      ([tokenPath]) =>
        !tokenPath.includes(".semantic.light.") &&
        !tokenPath.includes(".semantic.dark.") &&
        !tokenPath.includes(".domain."),
    )
    .map(
      ([tokenPath, token]) => `  ${cssVariableName(tokenPath)}: ${resolveTokenValue(root, token)};`,
    )
    .join("\n");

  const foundations = [
    `  --sl-font-sans: ${tokenValue(root, "font.family.sans")};`,
    `  --sl-font-mono: ${tokenValue(root, "font.family.mono")};`,
    `  --sl-radius-control: ${tokenValue(root, "radius.control")};`,
    `  --sl-radius-surface: ${tokenValue(root, "radius.surface")};`,
    `  --sl-radius-feature: ${tokenValue(root, "radius.feature")};`,
    `  --sl-radius-pill: ${tokenValue(root, "radius.pill")};`,
    `  --sl-duration-fast: ${tokenValue(root, "motion.duration.fast")};`,
    `  --sl-duration-normal: ${tokenValue(root, "motion.duration.normal")};`,
    `  --sl-duration-slow: ${tokenValue(root, "motion.duration.slow")};`,
  ].join("\n");

  return `/* Generated from design/tokens/stacklens.tokens.json. Do not edit manually. */

:root {
  color-scheme: light;
${references}
${foundations}
${createModeVariables(root, "light")}
${createCompatibilityVariables()}
}

.dark,
[data-theme="dark"] {
  color-scheme: dark;
${createModeVariables(root, "dark")}
${createCompatibilityVariables()}
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-success: var(--sl-success);
  --color-warning: var(--sl-warning);
  --color-info: var(--sl-info);
  --color-severity-critical: var(--sl-severity-critical);
  --color-severity-high: var(--sl-severity-high);
  --color-severity-medium: var(--sl-severity-medium);
  --color-severity-low: var(--sl-severity-low);
  --color-evidence-fact: var(--sl-evidence-fact);
  --color-evidence-heuristic: var(--sl-evidence-heuristic);
  --color-evidence-recommendation: var(--sl-evidence-recommendation);
  --color-confidence-high: var(--sl-confidence-high);
  --color-confidence-medium: var(--sl-confidence-medium);
  --color-confidence-low: var(--sl-confidence-low);
  --color-score-excellent: var(--sl-score-excellent);
  --color-score-good: var(--sl-score-good);
  --color-score-watch: var(--sl-score-watch);
  --color-score-poor: var(--sl-score-poor);
  --color-score-unknown: var(--sl-score-unknown);

  --font-sans: var(--sl-font-sans);
  --font-mono: var(--sl-font-mono);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: var(--sl-radius-feature);
}
`;
}

function createTokenModule(root) {
  const resolved = Object.fromEntries(
    Object.entries(flattenTokens(root)).map(([tokenPath, token]) => [
      tokenPath,
      resolveTokenValue(root, token),
    ]),
  );

  return `// Generated from design/tokens/stacklens.tokens.json. Do not edit manually.\n\nexport const tokens = Object.freeze(${JSON.stringify(resolved, null, 2)});\n`;
}

async function assertFile(filePath, expected) {
  let actual = "";
  try {
    actual = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Generated file is missing: ${path.relative(repositoryRoot, filePath)}`);
  }

  if (actual !== expected) {
    throw new Error(
      `Generated token output is stale: ${path.relative(repositoryRoot, filePath)}. Run the token build.`,
    );
  }
}

const root = JSON.parse(await readFile(sourcePath, "utf8"));
const themeCss = createThemeCss(root);
const tokenModule = createTokenModule(root);
const declaration = `export declare const tokens: Readonly<Record<string, string>>;\n`;

const outputs = [
  [path.join(distDirectory, "theme.css"), themeCss],
  [path.join(distDirectory, "tokens.js"), tokenModule],
  [path.join(distDirectory, "tokens.d.ts"), declaration],
];

if (checkOnly) {
  await Promise.all(outputs.map(([filePath, content]) => assertFile(filePath, content)));
} else {
  await mkdir(distDirectory, { recursive: true });
  await Promise.all(outputs.map(([filePath, content]) => writeFile(filePath, content)));
}
