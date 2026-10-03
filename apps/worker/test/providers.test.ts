import { describe, expect, it, vi } from "vitest";

import { createWorkerAnalysisDependencies } from "../src/providers.js";

function packument(name: string): Response {
  return Response.json({
    name,
    "dist-tags": { latest: "1.0.0" },
    versions: { "1.0.0": { version: "1.0.0" } },
  });
}

describe("Worker provider lifecycle [FR-003, NFR-008, NFR-009]", () => {
  it("serializes full npm responses while preserving input order", async () => {
    let release: (() => void) | undefined;
    const first = new Promise<void>((resolve) => {
      release = resolve;
    });
    const names: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const inputUrl =
        input instanceof Request ? input.url : input instanceof URL ? input.href : input;
      const name = new URL(inputUrl).pathname.slice(1);
      names.push(name);
      if (names.length === 1) await first;
      return packument(name);
    });
    const providers = createWorkerAnalysisDependencies(
      new AbortController().signal,
      undefined,
      fetchImpl,
    );
    const requests = ["one", "two", "three"].map((packageName) =>
      providers.npmRegistryProvider.fetch({ packageName }),
    );
    await vi.waitFor(() => expect(names).toEqual(["one"]));
    release?.();
    const results = await Promise.all(requests);
    expect(names).toEqual(["one", "two", "three"]);
    expect(results.map((result) => result.ok && result.data.packageName)).toEqual(names);
  });

  it("cancels active I/O and never starts queued npm requests", async () => {
    const controller = new AbortController();
    let transportSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      transportSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        transportSignal?.addEventListener("abort", () => reject(new Error("transport cancelled")), {
          once: true,
        });
      });
    });
    const providers = createWorkerAnalysisDependencies(controller.signal, undefined, fetchImpl);
    const requests = ["one", "two", "three"].map((packageName) =>
      providers.npmRegistryProvider.fetch({ packageName }),
    );
    const settled = Promise.allSettled(requests);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    expect(transportSignal).not.toBe(controller.signal);
    controller.abort();
    expect((await settled).map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(transportSignal?.aborted).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each(["github", "osv"])(
    "rejects interrupted %s acquisition instead of reporting provider limitations",
    async (name) => {
      const controller = new AbortController();
      const fetchImpl = vi.fn<typeof fetch>(
        async (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), {
              once: true,
            });
          }),
      );
      const providers = createWorkerAnalysisDependencies(controller.signal, undefined, fetchImpl);
      const request =
        name === "github"
          ? providers.githubRepositoryProvider.fetch({
              repositoryUrl: "https://github.com/acme/demo",
            })
          : providers.osvProvider.fetch({ queries: [{ packageName: "demo", version: "1.0.0" }] });
      const settled = Promise.allSettled([request]);
      await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
      controller.abort();
      expect((await settled)[0]?.status).toBe("rejected");
      expect(fetchImpl).toHaveBeenCalledOnce();
    },
  );
});
