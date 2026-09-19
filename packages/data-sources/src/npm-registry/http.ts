export class NpmRegistryResponseTooLargeError extends Error {}

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
      throw new NpmRegistryResponseTooLargeError(
        `npm Registry response exceeded the ${maxResponseBytes}-byte limit`,
      );
    }
  }

  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    totalBytes += result.value.byteLength;

    if (totalBytes > maxResponseBytes) {
      onLimitExceeded();
      throw new NpmRegistryResponseTooLargeError(
        `npm Registry response exceeded the ${maxResponseBytes}-byte limit`,
      );
    }

    parts.push(decoder.decode(result.value, { stream: true }));
  }

  parts.push(decoder.decode());

  return parts.join("");
}
