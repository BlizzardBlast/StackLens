import { IsoDateTimeSchema } from "@stacklens/contracts";

import { GitHubConfigurationError } from "./errors.js";

export function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new GitHubConfigurationError(`${label} must be a positive safe integer`);
  }

  return value;
}

export function validateObservedAt(value: string): string {
  const parsed = IsoDateTimeSchema.safeParse(value);

  if (!parsed.success) {
    throw new GitHubConfigurationError(
      "now() must return an ISO 8601 timestamp with an offset",
    );
  }

  return parsed.data;
}

export function validateGitHubRef(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.length === 0 || value.length > 500 || value !== value.trim()) {
    return undefined;
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code <= 0x1f || code === 0x7f) {
      return undefined;
    }
  }

  return value;
}
