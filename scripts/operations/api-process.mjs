// Host simulation for NFR-008/009. Never used by the production entrypoint.
import { createVercelApiRuntime } from "/app/dist/vercel-runtime.js";

const runtime = await createVercelApiRuntime();
await runtime.app.listen({ host: "0.0.0.0", port: 3000 });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void runtime.stop());
}
