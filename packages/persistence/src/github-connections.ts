import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import type { StackLensDatabase } from "./database.js";

export interface StoredGitHubConnection {
  readonly sessionHash: string;
  readonly githubId: string;
  readonly login: string;
  readonly sealedToken: string;
  readonly expiresAt: string;
}
export interface GitHubConnectionStore {
  save(record: StoredGitHubConnection, signal?: AbortSignal): Promise<void>;
  find(sessionHash: string, signal?: AbortSignal): Promise<StoredGitHubConnection | undefined>;
  remove(sessionHash: string, signal?: AbortSignal): Promise<void>;
  purgeExpired(now: string, signal?: AbortSignal): Promise<number>;
}

export class DrizzleGitHubConnectionStore implements GitHubConnectionStore {
  constructor(
    private readonly database: StackLensDatabase & { readonly $client: Pool },
    private readonly operationTimeoutMs = 8_000,
  ) {
    if (!Number.isSafeInteger(operationTimeoutMs) || operationTimeoutMs < 1)
      throw new Error("Connection operation timeout must be a positive integer.");
  }
  async save(record: StoredGitHubConnection, signal?: AbortSignal): Promise<void> {
    await this.#query(
      "INSERT INTO stacklens_auth.github_connection (session_hash, github_id, login, sealed_token, expires_at) VALUES ($1, $2, $3, $4, $5::timestamptz)",
      [record.sessionHash, record.githubId, record.login, record.sealedToken, record.expiresAt],
      signal,
    );
  }
  async find(
    sessionHash: string,
    signal?: AbortSignal,
  ): Promise<StoredGitHubConnection | undefined> {
    const result = await this.#query(
      "SELECT session_hash, github_id, login, sealed_token, expires_at FROM stacklens_auth.github_connection WHERE session_hash = $1",
      [sessionHash],
      signal,
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    if (
      typeof row.session_hash !== "string" ||
      typeof row.github_id !== "string" ||
      typeof row.login !== "string" ||
      typeof row.sealed_token !== "string" ||
      !(row.expires_at instanceof Date || typeof row.expires_at === "string")
    )
      throw new Error("Invalid connection record.");
    return {
      sessionHash: row.session_hash,
      githubId: row.github_id,
      login: row.login,
      sealedToken: row.sealed_token,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  }
  async remove(sessionHash: string, signal?: AbortSignal): Promise<void> {
    await this.#query(
      "DELETE FROM stacklens_auth.github_connection WHERE session_hash = $1",
      [sessionHash],
      signal,
    );
  }
  async purgeExpired(now: string, signal?: AbortSignal): Promise<number> {
    const result = await this.#query(
      "WITH expired AS (SELECT session_hash FROM stacklens_auth.github_connection WHERE expires_at <= $1::timestamptz ORDER BY expires_at LIMIT 100 FOR UPDATE SKIP LOCKED) DELETE FROM stacklens_auth.github_connection USING expired WHERE github_connection.session_hash = expired.session_hash RETURNING github_connection.session_hash",
      [now],
      signal,
    );
    return result.rows.length;
  }
  #query<Row extends QueryResultRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[],
    signal?: AbortSignal,
  ): Promise<QueryResult<Row>> {
    return runConnectionQuery<Row>(
      this.database.$client,
      text,
      values,
      this.operationTimeoutMs,
      signal,
    );
  }
}

/** Bound checkout, statement and commit; interruption destroys only this borrowed client. */
async function runConnectionQuery<Row extends QueryResultRow>(
  pool: Pool,
  text: string,
  values: readonly unknown[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<QueryResult<Row>> {
  signal?.throwIfAborted();
  const deadline = AbortSignal.timeout(timeoutMs);
  const operationSignal = signal === undefined ? deadline : AbortSignal.any([signal, deadline]);
  let borrowed: PoolClient | undefined;
  let completed = false;
  let abortOperation: (() => void) | undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abortOperation = () => {
      borrowed?.release(true);
      borrowed = undefined;
      reject(operationSignal.reason);
    };
    operationSignal.addEventListener("abort", abortOperation, { once: true });
  });
  const operation = (async () => {
    const client = await pool.connect();
    if (operationSignal.aborted) {
      client.release(true);
      operationSignal.throwIfAborted();
    }
    borrowed = client;
    await client.query("BEGIN");
    // The server cancels a blocked statement even if its client loses network connectivity.
    await client.query({
      text: "SELECT pg_catalog.set_config('statement_timeout', $1, true)",
      values: [String(timeoutMs)],
    });
    const result = await client.query<Row>({ text, values: [...values] });
    await client.query("COMMIT");
    completed = true;
    return result;
  })();
  try {
    return await Promise.race([operation, interrupted]);
  } finally {
    if (abortOperation !== undefined) operationSignal.removeEventListener("abort", abortOperation);
    borrowed?.release(!completed);
  }
}
