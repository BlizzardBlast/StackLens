import { stableIdHash } from "../stable-id.js";
import {
  GITHUB_API_BASE_URL,
  GITHUB_PROVIDER_ID,
  GITHUB_WEB_BASE_URL,
} from "./types.js";

function apiRepositoryPath(owner: string, name: string): string {
  return `repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

export function githubRepositoryApiUrl(owner: string, name: string): string {
  return new URL(apiRepositoryPath(owner, name), GITHUB_API_BASE_URL).toString();
}

export function githubCommitApiUrl(owner: string, name: string, ref: string): string {
  return new URL(
    `${apiRepositoryPath(owner, name)}/commits/${encodeURIComponent(ref)}`,
    GITHUB_API_BASE_URL,
  ).toString();
}

export function githubTreeApiUrl(owner: string, name: string, treeSha: string): string {
  const url = new URL(
    `${apiRepositoryPath(owner, name)}/git/trees/${encodeURIComponent(treeSha)}`,
    GITHUB_API_BASE_URL,
  );
  url.searchParams.set("recursive", "1");
  return url.toString();
}

export function githubBlobApiUrl(owner: string, name: string, blobSha: string): string {
  return new URL(
    `${apiRepositoryPath(owner, name)}/git/blobs/${encodeURIComponent(blobSha)}`,
    GITHUB_API_BASE_URL,
  ).toString();
}

export function githubCommitTreeUrl(owner: string, name: string, commitSha: string): string {
  return new URL(
    `${encodeURIComponent(owner)}/${encodeURIComponent(name)}/tree/${commitSha}`,
    GITHUB_WEB_BASE_URL,
  ).toString();
}

export function githubRepositorySourceId(
  owner: string,
  name: string,
  commitSha: string,
): string {
  return `source-github-${stableIdHash(
    JSON.stringify([GITHUB_PROVIDER_ID, owner.toLowerCase(), name.toLowerCase(), commitSha]),
  )}`;
}

export function githubInvalidRequestSourceId(requestKey: string): string {
  return `source-github-invalid-${stableIdHash(requestKey)}`;
}

export function githubEvidenceId(sourceId: string): string {
  return `evidence-github-${stableIdHash(sourceId)}`;
}

export function githubFailureId(sourceId: string, code: string, context = ""): string {
  return `failure-github-${stableIdHash(JSON.stringify([sourceId, code, context]))}`;
}

export function githubLimitationId(sourceId: string, code: string): string {
  return `limitation-github-${stableIdHash(JSON.stringify([sourceId, code]))}`;
}
