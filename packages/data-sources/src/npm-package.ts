export const NPM_PACKAGE_NAME_MAX_LENGTH = 214;
export const NPM_EXACT_VERSION_MAX_LENGTH = 256;

const NUMERIC_IDENTIFIER = "(?:0|[1-9]\\d*)";
const NON_NUMERIC_IDENTIFIER = "(?:\\d*[A-Za-z-][0-9A-Za-z-]*)";
const PRERELEASE_IDENTIFIER = `(?:${NUMERIC_IDENTIFIER}|${NON_NUMERIC_IDENTIFIER})`;
const BUILD_IDENTIFIER = "[0-9A-Za-z-]+";
const EXACT_NPM_VERSION_PATTERN = new RegExp(
  `^${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}\\.${NUMERIC_IDENTIFIER}` +
    `(?:-${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*)?` +
    `(?:\\+${BUILD_IDENTIFIER}(?:\\.${BUILD_IDENTIFIER})*)?$`,
);

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }

  return false;
}

export function isValidNpmPackageName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= NPM_PACKAGE_NAME_MAX_LENGTH &&
    value.trim() === value &&
    !containsControlCharacter(value)
  );
}

export function isExactNpmVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= NPM_EXACT_VERSION_MAX_LENGTH &&
    value.trim() === value &&
    !containsControlCharacter(value) &&
    EXACT_NPM_VERSION_PATTERN.test(value)
  );
}
