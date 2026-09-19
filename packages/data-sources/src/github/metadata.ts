import { GitHubBinaryContentError, GitHubRequestError } from "./errors.js";
import type { ParsedGitHubRepositoryUrl } from "./types.js";
import { validateGitHubRef } from "./validation.js";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

export interface RepositoryPayload {
  readonly owner: string;
  readonly name: string;
  readonly defaultBranch: string;
}

export interface CommitPayload {
  readonly commitSha: string;
  readonly treeSha: string;
}

export interface TreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: "blob" | "tree" | "commit";
  readonly sha: string;
  readonly size?: number;
}

export interface TreePayload {
  readonly entries: readonly TreeEntry[];
  readonly truncated: boolean;
}

export interface BlobPayload {
  readonly sha: string;
  readonly size: number;
  readonly content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTreeEntryType(value: unknown): value is TreeEntry["type"] {
  return value === "blob" || value === "tree" || value === "commit";
}

function isValidTreeEntryMode(type: TreeEntry["type"], mode: string): boolean {
  if (type === "blob") {
    return mode === "100644" || mode === "100755" || mode === "120000";
  }

  if (type === "tree") {
    return mode === "040000";
  }

  return mode === "160000";
}

export function parseRepositoryPayload(
  value: unknown,
  expected: ParsedGitHubRepositoryUrl,
): RepositoryPayload {
  if (!isRecord(value) || typeof value.private !== "boolean" || typeof value.name !== "string") {
    throw new TypeError("invalid repository payload");
  }

  if (value.private) {
    throw new GitHubRequestError(
      "github_private_repository_unsupported",
      `GitHub repository ${expected.owner}/${expected.name} is private; MVP acquisition supports public repositories only.`,
      false,
      expected.canonicalUrl,
    );
  }

  const owner = value.owner;
  const defaultBranch =
    typeof value.default_branch === "string" ? validateGitHubRef(value.default_branch) : undefined;

  if (!isRecord(owner) || typeof owner.login !== "string" || defaultBranch === undefined) {
    throw new TypeError("invalid repository payload");
  }

  if (
    owner.login.toLowerCase() !== expected.owner.toLowerCase() ||
    value.name.toLowerCase() !== expected.name.toLowerCase()
  ) {
    throw new GitHubRequestError(
      "github_repository_identity_mismatch",
      `GitHub returned a repository identity that does not match ${expected.owner}/${expected.name}.`,
      false,
      expected.canonicalUrl,
    );
  }

  return {
    owner: owner.login,
    name: value.name,
    defaultBranch,
  };
}

export function parseCommitPayload(value: unknown): CommitPayload {
  if (
    !isRecord(value) ||
    typeof value.sha !== "string" ||
    !SHA_PATTERN.test(value.sha) ||
    !isRecord(value.commit) ||
    !isRecord(value.commit.tree) ||
    typeof value.commit.tree.sha !== "string" ||
    !SHA_PATTERN.test(value.commit.tree.sha)
  ) {
    throw new TypeError("invalid commit payload");
  }

  return {
    commitSha: value.sha.toLowerCase(),
    treeSha: value.commit.tree.sha.toLowerCase(),
  };
}

export function parseTreePayload(value: unknown): TreePayload {
  if (!isRecord(value) || !Array.isArray(value.tree) || typeof value.truncated !== "boolean") {
    throw new TypeError("invalid tree payload");
  }

  const entries: TreeEntry[] = [];

  for (const item of value.tree) {
    if (
      !isRecord(item) ||
      typeof item.path !== "string" ||
      typeof item.mode !== "string" ||
      !isTreeEntryType(item.type) ||
      typeof item.sha !== "string" ||
      !SHA_PATTERN.test(item.sha) ||
      !isValidTreeEntryMode(item.type, item.mode)
    ) {
      throw new TypeError("invalid tree payload");
    }

    const size = item.size;

    if (
      size !== undefined &&
      (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0)
    ) {
      throw new TypeError("invalid tree payload");
    }

    entries.push({
      path: item.path,
      mode: item.mode,
      type: item.type,
      sha: item.sha.toLowerCase(),
      ...(size === undefined ? {} : { size }),
    });
  }

  return {
    entries,
    truncated: value.truncated,
  };
}

export function parseBlobPayload(value: unknown, expectedSha: string): BlobPayload {
  if (
    !isRecord(value) ||
    typeof value.sha !== "string" ||
    value.sha.toLowerCase() !== expectedSha.toLowerCase() ||
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    value.encoding !== "base64" ||
    typeof value.content !== "string"
  ) {
    throw new TypeError("invalid blob payload");
  }

  return {
    sha: value.sha.toLowerCase(),
    size: value.size,
    content: value.content,
  };
}

export function decodeBlobText(payload: BlobPayload): {
  readonly text: string;
  readonly byteLength: number;
} {
  let binary: string;

  try {
    binary = globalThis.atob(payload.content.replace(/\s+/g, ""));
  } catch {
    throw new TypeError("invalid base64 blob payload");
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  if (bytes.byteLength !== payload.size) {
    throw new TypeError("blob size mismatch");
  }

  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GitHubBinaryContentError("GitHub returned non-UTF-8 content");
  }

  if (text.includes("\0")) {
    throw new GitHubBinaryContentError("GitHub returned NUL-containing content");
  }

  return {
    text,
    byteLength: bytes.byteLength,
  };
}
