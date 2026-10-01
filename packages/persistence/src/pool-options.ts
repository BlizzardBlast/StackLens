export interface StackLensPoolOptions {
  readonly max?: number;
  readonly sslCa?: string;
  readonly connectionTimeoutMillis?: number;
}

/** Runtime configuration only; database credentials are never included in validation errors. */
export function readStackLensPoolOptions(
  environment: Readonly<Record<string, string | undefined>>,
): StackLensPoolOptions {
  const rawMax = environment.STACKLENS_DATABASE_POOL_MAX;
  const sslCa = environment.STACKLENS_DATABASE_SSL_CA;
  let max: number | undefined;

  if (rawMax !== undefined) {
    max = Number(rawMax);
    if (!/^[1-9]\d*$/.test(rawMax) || !Number.isSafeInteger(max)) {
      throw new Error("STACKLENS_DATABASE_POOL_MAX must be a positive integer.");
    }
  }
  if (sslCa !== undefined && sslCa.trim().length === 0) {
    throw new Error("STACKLENS_DATABASE_SSL_CA must contain a PEM certificate.");
  }

  return {
    ...(max === undefined ? {} : { max }),
    ...(sslCa === undefined ? {} : { sslCa }),
  };
}
