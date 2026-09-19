export class AnalyzerConfigurationError extends Error {
  override readonly name = "AnalyzerConfigurationError";

  constructor(message: string) {
    super(message);
  }
}

export class AnalyzerInvariantError extends Error {
  override readonly name = "AnalyzerInvariantError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
