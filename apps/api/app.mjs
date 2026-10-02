import { createVercelApiRuntime } from "./dist/vercel-runtime.js";

// Vercel owns HTTP binding. Warm requests share module initialization.
export const runtime = await createVercelApiRuntime().catch(() => {
  throw new Error("StackLens Vercel API failed to start.");
});
/** @type {import("fastify").FastifyInstance} */
const app = runtime.app;
await app.ready();
export default app.server;
