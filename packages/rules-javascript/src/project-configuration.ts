import type { FactRule } from "@stacklens/analyzer-core";
import type { AnalysisFact, AnalysisLimitation, ProjectEvidence } from "@stacklens/contracts";

import type { JavaScriptProjectSnapshot, JavaScriptStaticProjectFile } from "./project-snapshot.js";
import { compareCodeUnits, truncate } from "./rule-support.js";
import { stableHash } from "./stable-id.js";

const RULE_ID = "JS-CONFIG-013";
const RULE_VERSION = "1";
const MAX_STATIC_CONFIG_CONTENT_LENGTH = 512 * 1024;
const DYNAMIC_EXTENSIONS = ["js", "cjs", "mjs", "ts", "cts", "mts"] as const;

type ConfigurationInspectionMode = "declarative_json" | "dynamic_code";

interface ConfigurationDescriptor {
  readonly kind: string;
  readonly displayName: string;
  readonly inspectionMode: ConfigurationInspectionMode;
}

interface InspectedConfiguration {
  readonly descriptor: ConfigurationDescriptor;
  readonly file: JavaScriptStaticProjectFile;
}

interface InspectionResult {
  readonly characteristics: readonly string[];
  readonly partialReason?: string;
}

const DYNAMIC_CONFIG_PREFIXES = [
  ["eslint.config.", "ESLint flat configuration", "eslint"],
  ["jest.config.", "Jest configuration", "jest"],
  ["next.config.", "Next.js configuration", "next"],
  ["prettier.config.", "Prettier configuration", "prettier"],
  ["rollup.config.", "Rollup configuration", "rollup"],
  ["tailwind.config.", "Tailwind CSS configuration", "tailwind"],
  ["vite.config.", "Vite configuration", "vite"],
  ["vitest.config.", "Vitest configuration", "vitest"],
  ["webpack.config.", "webpack configuration", "webpack"],
] as const;

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function descriptorForPath(path: string): ConfigurationDescriptor | undefined {
  const name = baseName(path);

  if (name === "tsconfig.json" || /^tsconfig\.[^.]+\.json$/.test(name)) {
    return {
      kind: "typescript",
      displayName: "TypeScript configuration",
      inspectionMode: "declarative_json",
    };
  }

  if (name === ".eslintrc.json") {
    return {
      kind: "eslint",
      displayName: "ESLint legacy configuration",
      inspectionMode: "declarative_json",
    };
  }

  if (name === ".prettierrc" || name === ".prettierrc.json") {
    return {
      kind: "prettier",
      displayName: "Prettier configuration",
      inspectionMode: "declarative_json",
    };
  }

  if (name === "biome.json") {
    return {
      kind: "biome",
      displayName: "Biome configuration",
      inspectionMode: "declarative_json",
    };
  }

  if (name === "biome.jsonc") {
    return {
      kind: "biome",
      displayName: "Biome JSONC configuration",
      inspectionMode: "declarative_json",
    };
  }

  for (const [prefix, displayName, kind] of DYNAMIC_CONFIG_PREFIXES) {
    if (!name.startsWith(prefix)) {
      continue;
    }

    const extension = name.slice(prefix.length);

    if ((DYNAMIC_EXTENSIONS as readonly string[]).includes(extension)) {
      return {
        kind,
        displayName,
        inspectionMode: "dynamic_code",
      };
    }
  }

  return undefined;
}

function inspectedConfigurations(
  project: JavaScriptProjectSnapshot,
): readonly InspectedConfiguration[] {
  return (project.files ?? [])
    .flatMap((file) => {
      const descriptor = descriptorForPath(file.path);
      return descriptor === undefined ? [] : [{ descriptor, file }];
    })
    .toSorted((left, right) => compareCodeUnits(left.file.path, right.file.path));
}

export function projectConfigurationEvidenceId(path: string): string {
  return `evidence-js-config-${stableHash(path)}`;
}

export function projectConfigurationFactId(path: string, kind: string): string {
  return `fact-js-config-${stableHash(JSON.stringify([path, kind]))}`;
}

function limitationId(path: string, code: string): string {
  return `limitation-js-config-${stableHash(JSON.stringify([path, code]))}`;
}

export function createProjectConfigurationEvidence(
  project: JavaScriptProjectSnapshot,
): ProjectEvidence[] {
  return inspectedConfigurations(project).map(({ descriptor, file }) => ({
    id: projectConfigurationEvidenceId(file.path),
    kind: "project",
    summary: `Static project configuration evidence for ${descriptor.displayName} at ${file.path}.`,
    location: {
      path: file.path,
    },
  }));
}

function createLimitation(
  file: JavaScriptStaticProjectFile,
  code: string,
  kind: AnalysisLimitation["kind"],
  message: string,
): AnalysisLimitation {
  return {
    id: limitationId(file.path, code),
    kind,
    message: truncate(message, 4_000),
    affectedCategories: ["tooling"],
    sourceIds: [],
    ruleIds: [RULE_ID],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describePrimitiveOption(
  record: Record<string, unknown>,
  key: string,
  expected: "boolean" | "string" | "number",
): { readonly characteristic?: string; readonly invalid?: boolean } {
  const value = record[key];

  if (value === undefined) {
    return {};
  }

  if (typeof value !== expected) {
    return { invalid: true };
  }

  return {
    characteristic: `${key}=${JSON.stringify(value)}`,
  };
}

function inspectTypeScript(value: Record<string, unknown>): InspectionResult {
  const compilerOptions = value.compilerOptions;

  if (compilerOptions === undefined) {
    return {
      characteristics: [],
    };
  }

  if (!isRecord(compilerOptions)) {
    return {
      characteristics: [],
      partialReason: "compilerOptions is present but is not a JSON object.",
    };
  }

  const characteristics: string[] = [];
  let invalid = false;

  for (const [key, expected] of [
    ["strict", "boolean"],
    ["noUncheckedIndexedAccess", "boolean"],
    ["exactOptionalPropertyTypes", "boolean"],
    ["composite", "boolean"],
    ["jsx", "string"],
    ["module", "string"],
    ["target", "string"],
  ] as const) {
    const inspected = describePrimitiveOption(compilerOptions, key, expected);

    if (inspected.characteristic !== undefined) {
      characteristics.push(inspected.characteristic);
    }

    invalid ||= inspected.invalid === true;
  }

  return {
    characteristics,
    ...(invalid
      ? {
          partialReason:
            "One or more supported compilerOptions fields used an unsupported value type.",
        }
      : {}),
  };
}

function inspectEslint(value: Record<string, unknown>): InspectionResult {
  const characteristics: string[] = [];
  let invalid = false;

  const extendsValue = value.extends;

  if (typeof extendsValue === "string") {
    characteristics.push("extends=1 entry");
  } else if (
    Array.isArray(extendsValue) &&
    extendsValue.every((entry) => typeof entry === "string")
  ) {
    characteristics.push(`extends=${extendsValue.length} entries`);
  } else if (extendsValue !== undefined) {
    invalid = true;
  }

  const plugins = value.plugins;

  if (Array.isArray(plugins) && plugins.every((entry) => typeof entry === "string")) {
    characteristics.push(`plugins=${plugins.length}`);
  } else if (plugins !== undefined) {
    invalid = true;
  }

  if (typeof value.parser === "string") {
    characteristics.push(`parser=${JSON.stringify(value.parser)}`);
  } else if (value.parser !== undefined) {
    invalid = true;
  }

  if (isRecord(value.rules)) {
    characteristics.push(`rules=${Object.keys(value.rules).length}`);
  } else if (value.rules !== undefined) {
    invalid = true;
  }

  return {
    characteristics,
    ...(invalid
      ? { partialReason: "One or more supported ESLint fields used an unsupported value type." }
      : {}),
  };
}

function inspectPrettier(value: Record<string, unknown>): InspectionResult {
  const characteristics: string[] = [];
  let invalid = false;

  for (const [key, expected] of [
    ["semi", "boolean"],
    ["singleQuote", "boolean"],
    ["printWidth", "number"],
    ["tabWidth", "number"],
    ["trailingComma", "string"],
  ] as const) {
    const inspected = describePrimitiveOption(value, key, expected);

    if (inspected.characteristic !== undefined) {
      characteristics.push(inspected.characteristic);
    }

    invalid ||= inspected.invalid === true;
  }

  return {
    characteristics,
    ...(invalid
      ? { partialReason: "One or more supported Prettier fields used an unsupported value type." }
      : {}),
  };
}

function inspectBiome(value: Record<string, unknown>): InspectionResult {
  const characteristics: string[] = [];
  let invalid = false;

  for (const section of ["formatter", "linter", "assist"] as const) {
    const sectionValue = value[section];

    if (sectionValue === undefined) {
      continue;
    }

    if (!isRecord(sectionValue)) {
      invalid = true;
      continue;
    }

    const enabled = sectionValue.enabled;

    if (enabled === undefined) {
      characteristics.push(`${section}=configured`);
    } else if (typeof enabled === "boolean") {
      characteristics.push(`${section}.enabled=${enabled}`);
    } else {
      invalid = true;
    }
  }

  return {
    characteristics,
    ...(invalid
      ? { partialReason: "One or more supported Biome fields used an unsupported value type." }
      : {}),
  };
}

function inspectDeclarativeConfiguration(
  descriptor: ConfigurationDescriptor,
  file: JavaScriptStaticProjectFile,
): InspectionResult {
  if (file.content.length > MAX_STATIC_CONFIG_CONTENT_LENGTH) {
    return {
      characteristics: [],
      partialReason: `File exceeds the ${MAX_STATIC_CONFIG_CONTENT_LENGTH}-character static configuration inspection limit.`,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(file.content) as unknown;
  } catch {
    return {
      characteristics: [],
      partialReason:
        "File could not be parsed as strict JSON. JSONC/comments or malformed content are not interpreted by this static slice.",
    };
  }

  if (!isRecord(parsed)) {
    return {
      characteristics: [],
      partialReason: "Configuration root is not a JSON object.",
    };
  }

  switch (descriptor.kind) {
    case "typescript":
      return inspectTypeScript(parsed);
    case "eslint":
      return inspectEslint(parsed);
    case "prettier":
      return inspectPrettier(parsed);
    case "biome":
      return inspectBiome(parsed);
    default:
      return {
        characteristics: [],
      };
  }
}

function createFact(
  inspected: InspectedConfiguration,
  inspection: InspectionResult,
  limitationIds: readonly string[],
): AnalysisFact {
  const { descriptor, file } = inspected;
  const baseStatement =
    descriptor.inspectionMode === "dynamic_code"
      ? `Detected ${descriptor.displayName} at ${file.path}. The file contains executable configuration code and was not executed or evaluated.`
      : `Detected ${descriptor.displayName} at ${file.path} through static file inspection.`;
  const characteristics =
    inspection.characteristics.length === 0
      ? ""
      : ` Supported high-level characteristics: ${inspection.characteristics.join(", ")}.`;
  const partial =
    limitationIds.length === 0
      ? ""
      : " Inspection is partial; a rule limitation records the unsupported configuration detail.";

  return {
    id: projectConfigurationFactId(file.path, descriptor.kind),
    type: `project.configuration.${descriptor.kind}`,
    subject: {
      type: "configuration",
      name: descriptor.displayName,
      path: file.path,
    },
    statement: truncate(`${baseStatement}${characteristics}${partial}`, 4_000),
    rule: {
      id: RULE_ID,
      version: RULE_VERSION,
    },
    requirementIds: ["FR-013"],
    evidenceIds: [projectConfigurationEvidenceId(file.path)],
  };
}

export const projectConfigurationRule: FactRule<JavaScriptProjectSnapshot, unknown> = {
  kind: "fact",
  id: RULE_ID,
  version: RULE_VERSION,
  requirementIds: [
    "FR-013",
    "FR-021",
    "NFR-001",
    "NFR-002",
    "NFR-003",
    "NFR-004",
    "NFR-005",
    "SEC-001",
    "SEC-002",
  ],
  evaluate(context) {
    const facts: AnalysisFact[] = [];
    const limitations: AnalysisLimitation[] = [];

    for (const inspected of inspectedConfigurations(context.project)) {
      const { descriptor, file } = inspected;
      let inspection: InspectionResult = {
        characteristics: [],
      };
      let limitation: AnalysisLimitation | undefined;

      if (descriptor.inspectionMode === "dynamic_code") {
        limitation = createLimitation(
          file,
          "dynamic-configuration-unexecuted",
          "unsupported_configuration",
          `${descriptor.displayName} at ${file.path} is JavaScript/TypeScript configuration code. StackLens identified the file but did not import, execute, or resolve dynamic values.`,
        );
      } else {
        inspection = inspectDeclarativeConfiguration(descriptor, file);

        if (inspection.partialReason !== undefined) {
          limitation = createLimitation(
            file,
            file.content.length > MAX_STATIC_CONFIG_CONTENT_LENGTH
              ? "configuration-content-limit"
              : "configuration-partial-inspection",
            file.content.length > MAX_STATIC_CONFIG_CONTENT_LENGTH
              ? "resource_limit"
              : "unsupported_configuration",
            `${descriptor.displayName} at ${file.path} was only partially inspected. ${inspection.partialReason}`,
          );
        }
      }

      if (limitation !== undefined) {
        limitations.push(limitation);
      }

      facts.push(
        createFact(inspected, inspection, limitation === undefined ? [] : [limitation.id]),
      );
    }

    return {
      facts,
      limitations,
    };
  },
};
