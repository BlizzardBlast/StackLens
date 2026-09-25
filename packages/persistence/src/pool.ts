import { Pool } from "pg";

export function createStackLensPool(
  connectionString: string,
  onDatabasePoolError: (error: Error) => void = () => undefined,
): Pool {
  const pool = new Pool({ connectionString });

  pool.on("error", onDatabasePoolError);
  pool.on("connect", (client) => {
    client.on("error", onDatabasePoolError);
  });

  return pool;
}
