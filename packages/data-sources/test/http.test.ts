import { describe, expect, it, vi } from "vitest";

import { ProviderResponseTooLargeError, readBoundedResponseText } from "../src/http.js";

describe("bounded provider streams [DATA-001/003, NFR-008/009, SEC-002]", () => {
  it("preserves UTF-8 code points split across small chunks and the exact byte boundary", async () => {
    const text = '{"message":"résumé 😀"}';
    const bytes = new TextEncoder().encode(text);
    let index = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (index === bytes.length) controller.close();
          else controller.enqueue(bytes.slice(index, ++index));
        },
      }),
    );
    const exceeded = vi.fn<() => void>();
    expect(await readBoundedResponseText(response, bytes.length, exceeded)).toBe(text);
    expect(exceeded).not.toHaveBeenCalled();
    expect(response.body?.locked).toBe(false);
  });

  it.each([true, false])(
    "cancels an oversized response and releases its reader (length header: %s)",
    async (header) => {
      const cancelled = vi.fn<() => void>();
      const exceeded = vi.fn<() => void>();
      const response = new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.enqueue(new Uint8Array(5));
          },
          cancel: cancelled,
        }),
        header ? { headers: { "content-length": "5" } } : undefined,
      );
      await expect(readBoundedResponseText(response, 4, exceeded)).rejects.toBeInstanceOf(
        ProviderResponseTooLargeError,
      );
      expect(exceeded).toHaveBeenCalledOnce();
      expect(cancelled).toHaveBeenCalledOnce();
      expect(response.body?.locked).toBe(false);
    },
  );

  it("preserves a transport failure when cancellation also fails, without retaining a lock", async () => {
    const failure = new Error("fixture transport failure");
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(failure);
        },
      }),
    );
    await expect(readBoundedResponseText(response, 100, vi.fn<() => void>())).rejects.toBe(failure);
    expect(response.body?.locked).toBe(false);
  });
});
