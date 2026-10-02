// FR-003/022, NFR-009: import the native handler before the host binds its HTTP server.
// Run in an isolated process because the production entrypoint owns its module-scoped pool.
import assert from "node:assert/strict";
import { Server } from "node:http";

const originalListen = Reflect.get(Server.prototype, "listen");
let capturedServer;
Server.prototype.listen = function () {
  throw new Error("Native entry must leave HTTP binding to the host.");
};

let timeout;
let runtime;
try {
  const entry = await Promise.race([
    import("../apps/api/app.mjs"),
    new Promise((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Native entry import did not settle before binding.")),
        20_000,
      );
    }),
  ]);
  runtime = entry.runtime;
  assert(entry.default instanceof Server, "Native entry default must be an HTTP server.");
  capturedServer = entry.default;
  assert.equal(
    entry.default,
    runtime.app.server,
    "Native entry must export the Fastify HTTP server.",
  );
  assert.equal(
    capturedServer.listening,
    false,
    "Native handler was already bound before the host.",
  );
  clearTimeout(timeout);
  assert(capturedServer, "Native entry did not expose an HTTP server.");
  Server.prototype.listen = originalListen;
  await new Promise((resolve, reject) => {
    capturedServer.once("error", reject);
    capturedServer.listen(0, "127.0.0.1", resolve);
  });
  const address = capturedServer.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const openapi = await fetch(`${origin}/openapi.json`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(openapi.status, 200);
  assert.equal((await openapi.json()).openapi, "3.1.0");
  const invalid = await fetch(`${origin}/v1/analyze/manifest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.headers.get("Content-Type"), /json/);
  process.stdout.write(
    "Native Vercel entry settled before binding and served HTTP successfully.\n",
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Native entry smoke failed."}\n`,
  );
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  Server.prototype.listen = originalListen;
  await runtime?.stop();
}
