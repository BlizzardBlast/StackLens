import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const themePath = fileURLToPath(new URL("../dist/theme.css", import.meta.url));
const tokensPath = fileURLToPath(new URL("../dist/tokens.js", import.meta.url));

test("generated theme exposes StackLens domain semantics", async () => {
  const css = await readFile(themePath, "utf8");

  for (const variable of [
    "--sl-evidence-fact",
    "--sl-evidence-heuristic",
    "--sl-evidence-recommendation",
    "--sl-severity-high",
    "--sl-confidence-high",
    "--sl-score-unknown"
  ]) {
    assert.match(css, new RegExp(variable));
  }
});

test("generated token module exposes resolved values", async () => {
  const source = await readFile(tokensPath, "utf8");

  assert.match(source, /"color\.semantic\.light\.background"/);
  assert.match(source, /"radius\.surface": "12px"/);
});
