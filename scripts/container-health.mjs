import { createStackLensPool, readStackLensPoolOptions } from "@stacklens/persistence";

// NFR-009/SEC-007: emit no connection strings, response bodies or low-level errors.
let pool;

try {
  pool = createStackLensPool(
    process.env.DATABASE_URL,
    () => {
      process.exitCode = 1;
    },
    { ...readStackLensPoolOptions(process.env), max: 1, connectionTimeoutMillis: 5_000 },
  );
  await pool.query({ text: "SELECT 1", query_timeout: 5_000 });
  if (process.argv[2] === "api") {
    const port = process.env.STACKLENS_API_PORT ?? "3000";
    const response = await fetch(`http://127.0.0.1:${port}/openapi.json`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) process.exitCode = 1;
    await response.body?.cancel();
  }
} catch {
  process.exitCode = 1;
} finally {
  await pool?.end();
}
