import type { RequirementId } from "@stacklens/contracts";
import { normalizePackageManifest } from "@stacklens/rules-javascript";
import type { NormalizedPackageManifest } from "@stacklens/rules-javascript";

export type QuickManifestInput =
  | {
      readonly kind: "paste";
      readonly content: string;
    }
  | {
      readonly kind: "upload";
      readonly filename: string;
      readonly content: string;
    };

export type QuickManifestValidationErrorCode =
  | "empty_manifest"
  | "invalid_json"
  | "invalid_manifest"
  | "unsupported_upload";

export interface QuickManifestValidationError {
  readonly code: QuickManifestValidationErrorCode;
  readonly message: string;
  readonly requirementIds: readonly RequirementId[];
}

export type QuickManifestValidationResult =
  | {
      readonly ok: true;
      readonly project: NormalizedPackageManifest;
    }
  | {
      readonly ok: false;
      readonly error: QuickManifestValidationError;
    };

function requirementsForInput(input: QuickManifestInput): readonly RequirementId[] {
  return input.kind === "paste" ? ["FR-001", "FR-004"] : ["FR-002", "FR-004"];
}

function invalid(
  code: QuickManifestValidationErrorCode,
  message: string,
  requirementIds: readonly RequirementId[],
): QuickManifestValidationResult {
  return {
    ok: false,
    error: {
      code,
      message,
      requirementIds,
    },
  };
}

export function validateQuickManifestInput(
  input: QuickManifestInput,
): QuickManifestValidationResult {
  const requirementIds = requirementsForInput(input);

  if (input.kind === "upload" && input.filename !== "package.json") {
    return invalid(
      "unsupported_upload",
      "Uploaded quick-analysis files must be named package.json.",
      requirementIds,
    );
  }

  if (input.content.trim().length === 0) {
    return invalid(
      "empty_manifest",
      "Provide package.json JSON content before starting quick analysis.",
      requirementIds,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(input.content) as unknown;
  } catch {
    return invalid("invalid_json", "package.json must contain valid JSON.", requirementIds);
  }

  try {
    return {
      ok: true,
      project: normalizePackageManifest(parsed),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unsupported package manifest shape.";

    return invalid(
      "invalid_manifest",
      `package.json is not a supported manifest: ${detail}`,
      requirementIds,
    );
  }
}
