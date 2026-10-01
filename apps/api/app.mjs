import { createVercelApiRuntime } from "./dist/vercel-runtime.js";

// Vercel captures this native Fastify server. Warm requests share module initialization.
try {
  const runtime = await createVercelApiRuntime();
  /** @type {import("fastify").FastifyInstance} */
  const app = runtime.app;
  try {
    await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? "3000") });
  } catch (error) {
    await runtime.stop();
    throw error;
  }
} catch {
  throw new Error("StackLens Vercel API failed to start.");
}
