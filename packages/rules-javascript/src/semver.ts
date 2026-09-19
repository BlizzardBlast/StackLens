export interface ParsedSemanticVersion {
  readonly raw: string;
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly (number | string)[];
}

export type SemanticVersionDifference = "major" | "minor" | "patch" | "prerelease";

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseNumericIdentifier(value: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    return undefined;
  }

  if (value.length > 1 && value.startsWith("0")) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function parseCoreNumber(value: string): number | undefined {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function parseExactSemanticVersion(value: string): ParsedSemanticVersion | undefined {
  const match = SEMVER_PATTERN.exec(value);

  if (match === null) {
    return undefined;
  }

  const major = parseCoreNumber(match[1]!);
  const minor = parseCoreNumber(match[2]!);
  const patch = parseCoreNumber(match[3]!);

  if (major === undefined || minor === undefined || patch === undefined) {
    return undefined;
  }

  const prereleaseRaw = match[4];
  const prerelease: (number | string)[] = [];

  if (prereleaseRaw !== undefined) {
    for (const identifier of prereleaseRaw.split(".")) {
      if (/^\d+$/.test(identifier)) {
        const numericIdentifier = parseNumericIdentifier(identifier);

        if (numericIdentifier === undefined) {
          return undefined;
        }

        prerelease.push(numericIdentifier);
      } else {
        prerelease.push(identifier);
      }
    }
  }

  return {
    raw: value,
    major,
    minor,
    patch,
    prerelease,
  };
}

function comparePrereleaseIdentifier(left: number | string, right: number | string): number {
  if (typeof left === "number" && typeof right === "number") {
    return left === right ? 0 : left < right ? -1 : 1;
  }

  if (typeof left === "number") {
    return -1;
  }

  if (typeof right === "number") {
    return 1;
  }

  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareSemanticVersions(
  left: ParsedSemanticVersion,
  right: ParsedSemanticVersion,
): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (left[key] !== right[key]) {
      return left[key] < right[key] ? -1 : 1;
    }
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }

  if (left.prerelease.length === 0) {
    return 1;
  }

  if (right.prerelease.length === 0) {
    return -1;
  }

  const maximumLength = Math.max(left.prerelease.length, right.prerelease.length);

  for (let index = 0; index < maximumLength; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }

    if (rightIdentifier === undefined) {
      return 1;
    }

    const comparison = comparePrereleaseIdentifier(leftIdentifier, rightIdentifier);

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

export function newerVersionDifference(
  declared: ParsedSemanticVersion,
  comparison: ParsedSemanticVersion,
): SemanticVersionDifference | undefined {
  if (compareSemanticVersions(comparison, declared) <= 0) {
    return undefined;
  }

  if (comparison.major !== declared.major) {
    return "major";
  }

  if (comparison.minor !== declared.minor) {
    return "minor";
  }

  if (comparison.patch !== declared.patch) {
    return "patch";
  }

  return "prerelease";
}
