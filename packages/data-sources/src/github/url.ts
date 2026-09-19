import { GITHUB_WEB_BASE_URL } from "./types.js";
import type { ParsedGitHubRepositoryUrl } from "./types.js";

const OWNER_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

function decodePathSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function canonicalRepositoryUrl(owner: string, name: string): string {
  return new URL(
    `${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    GITHUB_WEB_BASE_URL,
  ).toString();
}

export function parsePublicGitHubRepositoryUrl(
  value: string,
): ParsedGitHubRepositoryUrl | undefined {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return undefined;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "github.com" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    return undefined;
  }

  const rawSegments = parsed.pathname.split("/").slice(1);

  while (rawSegments.at(-1) === "") {
    rawSegments.pop();
  }

  if (rawSegments.length !== 2 || rawSegments.some((segment) => segment.length === 0)) {
    return undefined;
  }

  const owner = decodePathSegment(rawSegments[0]!);
  const repositorySegment = decodePathSegment(rawSegments[1]!);

  if (owner === undefined || repositorySegment === undefined) {
    return undefined;
  }

  const name = repositorySegment.endsWith(".git")
    ? repositorySegment.slice(0, -4)
    : repositorySegment;

  if (
    !OWNER_PATTERN.test(owner) ||
    !REPOSITORY_PATTERN.test(name) ||
    name === "." ||
    name === ".."
  ) {
    return undefined;
  }

  return {
    owner,
    name,
    canonicalUrl: canonicalRepositoryUrl(owner, name),
  };
}
