export class GitHubConfigurationError extends Error {}

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
