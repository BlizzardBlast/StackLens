// Operator rehearsal only: preload synthetic transport; never mount this into a hosted Worker.
import { existsSync } from "node:fs";

import { capacityFetch, streamedPackument } from "./worker-capacity-fixtures.mjs";

globalThis.fetch = async (input, init) => {
  init?.signal?.throwIfAborted();
  if (
    ["interrupted", "ancestor_termination"].includes(process.env.STACKLENS_LIFECYCLE_SCENARIO) &&
    !existsSync("/tmp/release-fixture")
  ) {
    if (!init?.signal) throw new Error("lifecycle_fixture_requires_cancellation");
    await new Promise((_resolve, reject) => {
      init.signal.addEventListener(
        "abort",
        () => reject(new Error("Lifecycle fixture interrupted.")),
        { once: true },
      );
    });
  }
  const url = new URL(input instanceof Request ? input.url : input);
  if (url.origin === "https://registry.npmjs.org") {
    const name = decodeURIComponent(url.pathname.slice(1));
    if (!/^capacity-package-[0-7]$/u.test(name)) throw new Error("unexpected_lifecycle_package");
    return streamedPackument(name, init?.signal, 1_024);
  }
  return capacityFetch(input, init);
};
