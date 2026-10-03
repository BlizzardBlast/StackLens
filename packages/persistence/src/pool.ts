import { X509Certificate } from "node:crypto";

import { Pool } from "pg";

import type { StackLensPoolOptions } from "./pool-options.js";

export function createStackLensPool(
  connectionString: string,
  onDatabasePoolError: (error: Error) => void = () => undefined,
  options: StackLensPoolOptions = {},
): Pool {
  if (options.max !== undefined && (!Number.isSafeInteger(options.max) || options.max < 1)) {
    throw new Error("Database pool maximum must be a positive integer.");
  }
  if (
    options.connectionTimeoutMillis !== undefined &&
    (!Number.isSafeInteger(options.connectionTimeoutMillis) || options.connectionTimeoutMillis < 1)
  ) {
    throw new Error("Database connection timeout must be a positive integer.");
  }
  if (options.sslCa !== undefined) {
    // node-postgres URL SSL parameters replace the explicit SSL object, including its CA.
    let url: URL;
    try {
      url = new URL(connectionString);
    } catch {
      throw new Error("Certificate-verified database connections require a PostgreSQL URL.");
    }
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      [...url.searchParams.keys()].some((key) => key.toLowerCase().startsWith("ssl"))
    ) {
      throw new Error("Remove URL SSL parameters when configuring the database CA certificate.");
    }
    try {
      if (!options.sslCa.trim().startsWith("-----BEGIN CERTIFICATE-----")) {
        throw new Error("Invalid certificate format");
      }
      const certificate = new X509Certificate(options.sslCa);
      if (!certificate.ca) throw new Error("Certificate is not a CA");
    } catch {
      throw new Error("Database CA must contain a PEM certificate.");
    }
  }
  const pool = new Pool({
    connectionString,
    ...(options.applicationName === undefined ? {} : { application_name: options.applicationName }),
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10_000,
    ...(options.max === undefined ? {} : { max: options.max }),
    ...(options.sslCa === undefined
      ? {}
      : { ssl: { ca: options.sslCa, rejectUnauthorized: true } }),
  });

  pool.on("error", onDatabasePoolError);
  pool.on("connect", (client) => {
    client.on("error", onDatabasePoolError);
  });

  return pool;
}
