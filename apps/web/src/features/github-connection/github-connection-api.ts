import * as z from "zod";

import type { FetchLike } from "../repository-analysis/repository-analysis-api.js";

const SessionSchema = z
  .strictObject({
    enabled: z.boolean(),
    installationUrl: z
      .string()
      .regex(/^https:\/\/github\.com\/apps\/[a-z0-9-]+\/installations\/new$/u)
      .optional(),
    csrfToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/u)
      .optional(),
    user: z.strictObject({ login: z.string(), expiresAt: z.iso.datetime() }).optional(),
  })
  .refine((value) => (value.user === undefined) === (value.csrfToken === undefined));
export type GitHubSessionView = z.infer<typeof SessionSchema>;

export class GitHubConnectionApiError extends Error {
  override readonly name = "GitHubConnectionApiError";
  constructor() {
    super("GitHub connection is unavailable. Reconnect and check the repository grant.");
  }
}

async function payload<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) throw new GitHubConnectionApiError();
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new GitHubConnectionApiError();
  return parsed.data;
}

export function createGitHubConnectionClient(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
) {
  return {
    async session(signal?: AbortSignal): Promise<GitHubSessionView> {
      // Host-only cookies require the same-origin API proxy used by deployed web builds.
      if ((import.meta.env.VITE_STACKLENS_API_BASE_URL ?? "") !== "") return { enabled: false };
      return payload(
        await fetchImpl("/v1/auth/session", {
          credentials: "same-origin",
          ...(signal === undefined ? {} : { signal }),
        }),
        SessionSchema,
      );
    },
    async signOut(csrfToken: string): Promise<void> {
      await payload(
        await fetchImpl("/v1/auth/sign-out", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-stacklens-csrf": csrfToken },
          body: "{}",
        }),
        z.strictObject({ signedOut: z.literal(true) }),
      );
    },
    async submit(repositoryUrl: string, csrfToken: string): Promise<{ analysisId: string }> {
      return payload(
        await fetchImpl("/v1/analyses/github", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json", "x-stacklens-csrf": csrfToken },
          body: JSON.stringify({ repositoryUrl }),
        }),
        z.strictObject({ analysisId: z.string().min(1) }),
      );
    },
  };
}
export const githubConnectionClient = createGitHubConnectionClient();
