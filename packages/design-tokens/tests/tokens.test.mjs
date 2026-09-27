import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { tokens } from "../dist/tokens.js";

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
    "--sl-score-unknown",
  ]) {
    assert.match(css, new RegExp(variable));
  }
});

test("generated token module exposes resolved values", async () => {
  const source = await readFile(tokensPath, "utf8");

  assert.match(source, /"color\.semantic\.light\.background"/);
  assert.match(source, /"radius\.surface": "12px"/);
});

function rgb(hex) {
  assert.match(hex, /^#[\da-f]{6}$/i);
  return hex
    .slice(1)
    .match(/../g)
    .map((part) => Number.parseInt(part, 16) / 255);
}

function luminance(color) {
  const linear = color.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function composite(foreground, background, opacity) {
  return foreground.map((channel, index) => channel * opacity + background[index] * (1 - opacity));
}

function assertContrast(foreground, background, minimum, label) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  const ratio = (lighter + 0.05) / (darker + 0.05);
  assert.ok(ratio >= minimum, `${label}: ${ratio.toFixed(2)}:1 is below ${minimum}:1`);
}

for (const mode of ["light", "dark"]) {
  const semantic = (name) => rgb(tokens[`color.semantic.${mode}.${name}`]);

  test(`NFR-006: ${mode} text, domain badges, inputs, and focus retain AA contrast`, () => {
    const domainPaths = Object.keys(tokens).filter(
      (path) => path.startsWith("color.domain.") && path.includes(`.${mode}.`),
    );
    for (const surface of ["background", "surface", "surfaceRaised", "surfaceMuted"]) {
      const background = semantic(surface);
      for (const role of [
        "foreground",
        "mutedForeground",
        "primary",
        "danger",
        "success",
        "warning",
        "info",
      ]) {
        assertContrast(semantic(role), background, 4.5, `${mode} ${role} on ${surface}`);
      }
      for (const path of domainPaths) {
        const foreground = rgb(tokens[path]);
        const isBadge = path.includes(".severity.") || path.includes(".evidence.");
        assertContrast(
          foreground,
          isBadge ? composite(foreground, background, 0.1) : background,
          4.5,
          `${path} on ${surface}${isBadge ? " with badge tint" : ""}`,
        );
      }
      assertContrast(semantic("input"), background, 3, `${mode} input on ${surface}`);
      assertContrast(semantic("focus"), background, 3, `${mode} focus on ${surface}`);
      const warningSurface = composite(semantic("warning"), background, 0.1);
      const warningIcon = composite(semantic("warning"), warningSurface, 0.15);
      assertContrast(
        semantic("warning"),
        warningIcon,
        4.5,
        `${mode} limitation icon on ${surface}`,
      );
      assertContrast(
        semantic("mutedForeground"),
        warningSurface,
        4.5,
        `${mode} limitation copy on ${surface}`,
      );
    }
  });

  test(`NFR-006: ${mode} action and brand surfaces preserve readable text`, () => {
    for (const [backgroundRole, foregroundRole] of [
      ["primary", "primaryForeground"],
      ["danger", "dangerForeground"],
    ]) {
      assertContrast(
        semantic(foregroundRole),
        semantic(backgroundRole),
        4.5,
        `${mode} ${backgroundRole} button`,
      );
      for (const surface of ["background", "surface"]) {
        assertContrast(
          semantic(foregroundRole),
          composite(semantic(backgroundRole), semantic(surface), 0.9),
          4.5,
          `${mode} ${backgroundRole} hover on ${surface}`,
        );
      }
    }
    for (const role of ["brandForeground", "brandMuted", "brandAccent"]) {
      assertContrast(semantic(role), semantic("brandSurface"), 4.5, `${mode} ${role}`);
    }
  });

  test(`NFR-006: ${mode} selected controls and error messages retain contrast on tinted surfaces`, () => {
    for (const surface of ["background", "surface"]) {
      const selected = composite(semantic("primary"), semantic(surface), 0.05);
      for (const role of ["foreground", "mutedForeground", "primary"]) {
        assertContrast(semantic(role), selected, 4.5, `${mode} ${role} on selected ${surface}`);
      }
      for (const role of ["input", "focus"]) {
        assertContrast(semantic(role), selected, 3, `${mode} ${role} on selected ${surface}`);
      }
      const error = composite(semantic("danger"), semantic(surface), 0.05);
      assertContrast(semantic("danger"), error, 4.5, `${mode} error copy on ${surface}`);
    }
    assertContrast(
      semantic("primary"),
      semantic("surfaceMuted"),
      3,
      `${mode} evidence coverage bar against its track`,
    );
  });

  test(`NFR-006: ${mode} progress copy stays readable throughout the activity pulse`, () => {
    const row = composite(semantic("primary"), semantic("surface"), 0.05);
    // The pulse varies between half and full opacity over the row's existing 5% tint.
    // Include the untinted row and sample the complete animation, not just its resting state.
    for (let step = 0; step <= 20; step += 1) {
      const background = composite(semantic("primary"), row, step / 200);
      for (const role of ["foreground", "mutedForeground"]) {
        assertContrast(semantic(role), background, 4.5, `${mode} ${role} at pulse step ${step}`);
      }
    }
  });
}
