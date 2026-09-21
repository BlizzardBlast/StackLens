import swagger from "@fastify/swagger";
import Fastify, { type FastifyInstance } from "fastify";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import {
  ApiErrorSchema,
  registerRepositoryAnalysisRoutes,
  type RepositoryAnalysisHttpDependencies,
} from "./repository-analysis-http.js";

export interface StackLensApiOptions extends RepositoryAnalysisHttpDependencies {
  readonly logger?: boolean;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function validationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error &&
    error.validation !== undefined
  );
}

function errorCode(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return undefined;
  }

  return error.code;
}

export async function createStackLensApi(options: StackLensApiOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (validationFailure(error)) {
      return reply.code(400).send({
        code: "invalid_request",
        message: "Request does not match the API schema.",
      });
    }

    request.log.error(
      {
        errorName: errorName(error),
        errorCode: errorCode(error),
      },
      "Unhandled StackLens API error.",
    );

    return reply.code(500).send({
      code: "internal_error",
      message: "The request could not be completed.",
    });
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "StackLens API",
        version: "0.1.0",
        description: "Public StackLens REST API.",
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  registerRepositoryAnalysisRoutes(app, options);

  app.get(
    "/openapi.json",
    {
      schema: {
        hide: true,
        response: {
          500: ApiErrorSchema,
        },
      },
    },
    async (_request, reply) => reply.send(app.swagger()),
  );

  return app;
}
