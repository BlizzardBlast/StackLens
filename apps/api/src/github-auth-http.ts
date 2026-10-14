import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import * as z from "zod";

import {
  GitHubConnectionError,
  type GitHubConnectionService,
  type GitHubSession,
} from "@stacklens/github-auth";

import { ApiErrorSchema } from "./http-contracts.js";

export function sessionCookieName(service: GitHubConnectionService): string {
  return service.config.publicOrigin.startsWith("https:")
    ? "__Host-stacklens_session"
    : "stacklens_session";
}
function stateCookieName(service: GitHubConnectionService): string {
  return service.config.publicOrigin.startsWith("https:")
    ? "__Host-stacklens_oauth"
    : "stacklens_oauth";
}
export function readCookie(request: FastifyRequest, name: string): string {
  const raw = request.headers.cookie ?? "";
  if (raw.length > 8_192) return "";
  const matches = raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0]!.slice(name.length + 1) : "";
}
function cookie(
  service: GitHubConnectionService,
  name: string,
  value: string,
  maxAge: number,
): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${service.config.publicOrigin.startsWith("https:") ? "; Secure" : ""}`;
}

export async function requestSession(
  service: GitHubConnectionService | undefined,
  request: FastifyRequest,
): Promise<GitHubSession | undefined> {
  return service === undefined
    ? undefined
    : service.session(readCookie(request, sessionCookieName(service)));
}

export async function authorizeConnectedRequest(
  service: GitHubConnectionService | undefined,
  request: FastifyRequest,
): Promise<GitHubSession> {
  if (service === undefined) throw new GitHubConnectionError();
  const csrf = request.headers["x-stacklens-csrf"];
  return service.authorize(
    readCookie(request, sessionCookieName(service)),
    typeof csrf === "string" ? csrf : "",
    request.headers.origin,
  );
}

export function registerGitHubAuthRoutes(
  app: FastifyInstance,
  service?: GitHubConnectionService,
): void {
  const api = app.withTypeProvider<ZodTypeProvider>();
  api.get(
    "/v1/auth/session",
    {
      schema: {
        operationId: "getGitHubSession",
        tags: ["connection"],
        response: {
          200: z.strictObject({
            enabled: z.boolean(),
            installationUrl: z.string().optional(),
            csrfToken: z.string().optional(),
            user: z.strictObject({ login: z.string(), expiresAt: z.iso.datetime() }).optional(),
          }),
          503: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const session = await requestSession(service, request);
        return {
          enabled: service !== undefined,
          ...(service === undefined ? {} : { installationUrl: service.config.installationUrl }),
          ...(session === undefined
            ? {}
            : {
                user: { login: session.login, expiresAt: session.expiresAt },
                csrfToken: session.csrfToken,
              }),
        };
      } catch {
        return reply.code(503).send({
          code: "connection_unavailable",
          message: "GitHub connection is temporarily unavailable.",
        });
      }
    },
  );
  api.get(
    "/v1/auth/github/start",
    {
      schema: {
        operationId: "connectGitHub",
        tags: ["connection"],
        response: { 400: ApiErrorSchema, 503: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      if (service === undefined)
        return reply.code(503).send({
          code: "connection_disabled",
          message: "GitHub connection is not enabled on this deployment.",
        });
      if (request.headers["sec-fetch-site"] === "cross-site")
        return reply.code(400).send({
          code: "invalid_connection_request",
          message: "Start the connection from StackLens.",
        });
      const started = service.begin();
      reply.header(
        "Set-Cookie",
        cookie(service, stateCookieName(service), started.stateCookie, 600),
      );
      return reply.redirect(started.location);
    },
  );
  api.get(
    "/v1/auth/github/callback",
    {
      schema: {
        operationId: "finishGitHubConnection",
        tags: ["connection"],
        querystring: z.strictObject({
          code: z.string().max(256).optional(),
          state: z.string().max(256).optional(),
          error: z.string().max(256).optional(),
          error_description: z.string().max(2_000).optional(),
          // Provider error metadata is accepted but never fetched, displayed or used as a redirect.
          error_uri: z.string().max(2_000).optional(),
        }),
        response: { 400: ApiErrorSchema, 503: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      if (service === undefined)
        return reply.code(503).send({
          code: "connection_disabled",
          message: "GitHub connection is not enabled on this deployment.",
        });
      const pending = readCookie(request, stateCookieName(service));
      reply.header("Set-Cookie", cookie(service, stateCookieName(service), "", 0));
      reply.header("Referrer-Policy", "no-referrer");
      try {
        if (request.query.error !== undefined || !request.query.code || !request.query.state)
          throw new GitHubConnectionError();
        const session = await service.finish(pending, request.query.state, request.query.code);
        reply.header("Set-Cookie", [
          cookie(service, stateCookieName(service), "", 0),
          cookie(
            service,
            sessionCookieName(service),
            session.cookie,
            Math.max(0, Math.floor((Date.parse(session.expiresAt) - service.now()) / 1_000)),
          ),
        ]);
        return reply.redirect(`${service.config.publicOrigin}/?github=connected`);
      } catch {
        return reply.redirect(`${service.config.publicOrigin}/?github=error`);
      }
    },
  );
  api.post(
    "/v1/auth/sign-out",
    {
      schema: {
        operationId: "signOutGitHub",
        tags: ["connection"],
        body: z.strictObject({}),
        response: {
          200: z.strictObject({ signedOut: z.literal(true) }),
          403: ApiErrorSchema,
          503: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        await authorizeConnectedRequest(service, request);
        if (service === undefined) throw new GitHubConnectionError();
        await service.signOut(readCookie(request, sessionCookieName(service)));
        reply.header("Set-Cookie", cookie(service, sessionCookieName(service), "", 0));
        return { signedOut: true as const };
      } catch (error) {
        return reply.code(error instanceof GitHubConnectionError ? 403 : 503).send({
          code: "connection_unavailable",
          message: "GitHub connection could not be ended. Refresh and try again.",
        });
      }
    },
  );
}
