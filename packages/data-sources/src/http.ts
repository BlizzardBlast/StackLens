export class ProviderResponseTooLargeError extends Error {}

export async function readBoundedResponseText(
  response: Response,
  maxResponseBytes: number,
  onLimitExceeded: () => void,
): Promise<string> {
  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const parsedLength = Number(contentLength);

    if (Number.isFinite(parsedLength) && parsedLength > maxResponseBytes) {
      onLimitExceeded();
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderResponseTooLargeError(
        `Provider response exceeded the ${maxResponseBytes}-byte limit`,
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let totalBytes = 0;
  let completed = false;

  try {
    // A loop releases each transport chunk instead of retaining a recursive promise chain
    // until the entire response arrives. Preserve streaming UTF-8 decoding and byte bounds.
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- Streaming must check each chunk before reading the next.
      const result = await reader.read();
      if (result.done) {
        completed = true;
        break;
      }
      totalBytes += result.value.byteLength;
      if (totalBytes > maxResponseBytes) {
        onLimitExceeded();
        throw new ProviderResponseTooLargeError(
          `Provider response exceeded the ${maxResponseBytes}-byte limit`,
        );
      }
      text += decoder.decode(result.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
