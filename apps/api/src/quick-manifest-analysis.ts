import { runAnalyzer } from "@stacklens/analyzer-core";
import type { AnalyzerDefinition } from "@stacklens/analyzer-core";
import type { AnalysisLimitation, AnalysisReport } from "@stacklens/contracts";
import {
  createDependencyInventoryEvidence,
  createWorkspaceEvidence,
} from "@stacklens/rules-javascript";
import type {
  JavaScriptProjectSnapshot,
  JavaScriptAnalysisMetadata,
} from "@stacklens/rules-javascript";

import { createManifestFingerprint } from "./manifest-fingerprint.js";
import { validateQuickManifestInput } from "./manifest-input.js";
import type { QuickManifestInput, QuickManifestValidationError } from "./manifest-input.js";

export const QUICK_MANIFEST_INPUT_LIMITATION_ID = "limitation-quick-manifest-input-mode";
export const QUICK_MANIFEST_METADATA_LIMITATION_ID = "limitation-quick-manifest-external-data";

export interface QuickManifestAnalysisCommand {
  readonly analysisId: string;
  readonly createdAt: string;
  readonly input: QuickManifestInput;
}

export interface QuickManifestAnalysisDependencies {
  readonly analyzer: AnalyzerDefinition<JavaScriptProjectSnapshot, JavaScriptAnalysisMetadata>;
}

export type QuickManifestAnalysisResult =
  | {
      readonly ok: true;
      readonly report: AnalysisReport;
    }
  | {
      readonly ok: false;
      readonly error: QuickManifestValidationError;
    };

function createQuickManifestLimitations(): AnalysisLimitation[] {
  return [
    {
      id: QUICK_MANIFEST_INPUT_LIMITATION_ID,
      kind: "input_mode",
      message:
        "Quick manifest analysis does not inspect repository source or configuration, so source-dependent conclusions are unavailable.",
      affectedCategories: ["dependencies", "maintainability", "testing", "tooling"],
      sourceIds: [],
      ruleIds: [],
    },
    {
      id: QUICK_MANIFEST_METADATA_LIMITATION_ID,
      kind: "external_data",
      message:
        "External package and vulnerability metadata is not available in this analysis snapshot.",
      affectedCategories: ["dependencies", "security"],
      sourceIds: [],
      ruleIds: [],
    },
  ];
}

export function analyzeQuickManifest(
  command: QuickManifestAnalysisCommand,
  dependencies: QuickManifestAnalysisDependencies,
): QuickManifestAnalysisResult {
  const validation = validateQuickManifestInput(command.input);

  if (!validation.ok) {
    return validation;
  }

  const fingerprint = createManifestFingerprint(command.input.content);
  const member = { ...validation.project, packagePath: ".", role: "package" as const };
  const project =
    dependencies.analyzer.reportSchemaVersion === "2.0.0"
      ? { ...member, workspacePackages: [member] }
      : validation.project;
  const evidence =
    dependencies.analyzer.reportSchemaVersion === "2.0.0"
      ? createWorkspaceEvidence(project)
      : createDependencyInventoryEvidence(project);

  const report = runAnalyzer(dependencies.analyzer, {
    analysisId: command.analysisId,
    createdAt: command.createdAt,
    input: {
      type: "manifest",
      fingerprint,
    },
    project,
    metadata: {},
    sources: [],
    evidence,
    limitations: createQuickManifestLimitations(),
  });

  return {
    ok: true,
    report,
  };
}
