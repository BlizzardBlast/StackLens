import { createVercelApiRuntime } from "./dist/vercel-runtime.js";

// Vercel captures this native Fastify server. Warm requests share module initialization.
export const runtime = await createVercelApiRuntime().catch(() => {
  throw new Error("StackLens Vercel API failed to start.");
});
/** @type {import("fastify").FastifyInstance} */
const app = runtime.app;
export default app.server;
// The native host captures listen() and binds only after this module finishes importing.
// Awaiting listen here would keep both sides waiting for each other.
void app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? "3000") }).catch(async () => {
  await runtime.stop().catch(() => undefined);
  throw new Error("StackLens Vercel API failed to listen.");
});
