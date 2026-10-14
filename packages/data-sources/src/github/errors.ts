export class GitHubConfigurationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "GitHubConfigurationError";
  }
}

export class GitHubRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly reference: string,
  ) {
    super(message);
  }
}

export class GitHubBinaryContentError extends Error {}
