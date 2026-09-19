import type {
  AnalysisLimitation,
  PartialFailure,
  UnavailableDataSource,
} from "@stacklens/contracts";

import type { ProviderFailure } from "../provider.js";
import { githubFailureId, githubLimitationId } from "./ids.js";
import { GITHUB_PROVIDER_ID } from "./types.js";

const MAX_LIMITATION_PATH_SAMPLES = 5;

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function createUnavailableResult(
  sourceId: string,
  attemptedAt: string,
  code: string,
  message: string,
  retryable: boolean,
  reference?: string,
): ProviderFailure {
  const source: UnavailableDataSource = {
    id: sourceId,
    provider: GITHUB_PROVIDER_ID,
    status: "unavailable",
    attemptedAt,
    ...(reference === undefined ? {} : { reference }),
  };
  const failure: PartialFailure = {
    id: githubFailureId(sourceId, code),
    scope: "source",
    sourceId,
    code,
    message,
    retryable,
    occurredAt: attemptedAt,
  };

  return {
    ok: false,
    source,
    failure,
  };
}

export function createPartialFailure(
  sourceId: string,
  occurredAt: string,
  code: string,
  message: string,
  retryable: boolean,
  context = "",
): PartialFailure {
  return {
    id: githubFailureId(sourceId, code, context),
    scope: "source",
    sourceId,
    code,
    message,
    retryable,
    occurredAt,
  };
}

export function createLimitation(
  sourceId: string,
  code: string,
  kind: AnalysisLimitation["kind"],
  message: string,
): AnalysisLimitation {
  return {
    id: githubLimitationId(sourceId, code),
    kind,
    message: message.slice(0, 4_000),
    affectedCategories: ["dependencies", "maintainability", "testing", "tooling"],
    sourceIds: [sourceId],
    ruleIds: [],
  };
}

export function samplePaths(paths: readonly string[]): string {
  const sorted = [...paths].toSorted(compareCodeUnits);
  const samples = sorted.slice(0, MAX_LIMITATION_PATH_SAMPLES).map((path) => JSON.stringify(path));
  const suffix = sorted.length > samples.length ? ` (+${sorted.length - samples.length} more)` : "";
  return `${samples.join(", ")}${suffix}`;
}
