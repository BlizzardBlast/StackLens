import { describe, expect, it } from "vitest";

import { confirmedDeadOwnerId } from "../src/recovery.js";

describe("Operator recovery arguments [FR-003, NFR-008, NFR-009]", () => {
  it.each(["worker", "pool"])("accepts one explicitly confirmed %s owner ID", (prefix) => {
    expect(confirmedDeadOwnerId(["--confirmed-dead-owner", `${prefix}-0123456789abcdef01`])).toBe(
      `${prefix}-0123456789abcdef01`,
    );
  });
  it.each(
    [
      [],
      ["worker-0123456789abcdef01"],
      ["--confirmed-dead-owner", "all"],
      ["--confirmed-dead-owner", "42"],
      ["--confirmed-dead-owner", "worker-0123456789abcdef01", "worker-fedcba987654321001"],
      ["--confirmed-dead-owner", "worker-0123456789abcdef01\n"],
    ].map((args) => ({ args })),
  )("rejects broad, inferred or missing targets $args", ({ args }) => {
    expect(() => confirmedDeadOwnerId(args)).toThrow("exactly one");
  });
});
