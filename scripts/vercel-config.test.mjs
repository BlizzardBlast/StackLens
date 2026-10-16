import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { callbackLandingHeaders, callbackLandingPath } from "./github-callback-landing.mjs";
import { createVercelConfig } from "./vercel-config.mjs";

await test("FR-100/SEC-007: isolated landing has one exact hash policy and no app/third-party resources", () => {
  const config = createVercelConfig({ STACKLENS_API_ORIGIN: "https://api.example.com" });
  assert.deepEqual(
    config.headers.find((rule) => rule.source === callbackLandingPath).headers,
    callbackLandingHeaders,
  );
  const html = readFileSync(
    new URL("../apps/web/public/auth/github/complete.html", import.meta.url),
    "utf8",
  );
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)];
  assert.equal(scripts.length, 1);
  const hash = createHash("sha256").update(scripts[0][1].replace(/\r\n?/gu, "\n")).digest("base64");
  const policy = callbackLandingHeaders.find(
    (header) => header.key === "Content-Security-Policy",
  ).value;
  assert.ok(policy.includes(`script-src 'sha256-${hash}'`));
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval|report-to|report-uri|report-sample/u);
  assert.doesNotMatch(html, /<script[^>]+src|<link|<img|<iframe|analytics|console\./iu);
});

await test("FR-003/004/022: repository and quick requests preserve the public API prefix", () => {
  const config = createVercelConfig({ STACKLENS_API_ORIGIN: " https://api.example.com/ " });
  const apiRewrite = config.rewrites.find((rewrite) => rewrite.source === "/v1/:path*");

  for (const path of ["analyses/repository", "analyses/test-id", "analyze/manifest"]) {
    assert.equal(
      apiRewrite.destination.replace(":path*", path),
      `https://api.example.com/v1/${path}`,
    );
  }

  assert.equal(
    config.rewrites.find((rewrite) => rewrite.source === "/openapi.json").destination,
    "https://api.example.com/openapi.json",
  );
});

await test("FR-004/022: known SPA deep links load HTML without masking unknown API paths", () => {
  const config = createVercelConfig({ STACKLENS_API_ORIGIN: "https://api.example.com" });
  const htmlRewrites = config.rewrites.filter((rewrite) => rewrite.destination === "/index.html");

  assert.deepEqual(
    htmlRewrites.map((rewrite) => rewrite.source),
    ["/quick", "/analyses/:analysisId"],
  );
  assert.equal(
    config.rewrites.some((rewrite) => rewrite.source === "/(.*)"),
    false,
  );
});

await test("SEC-003/NFR-008: polling responses cannot be retained in browser or CDN caches", () => {
  const config = createVercelConfig({ STACKLENS_API_ORIGIN: "https://api.example.com" });
  const headers = config.headers.find((rule) => rule.source === "/v1/:path*").headers;

  for (const name of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control"]) {
    assert.match(headers.find((header) => header.key === name).value, /\bno-store\b/);
  }
});

await test("SEC-007: missing and unsafe origins fail without echoing credentials", () => {
  for (const origin of [
    undefined,
    "",
    "   ",
    "not a URL",
    "http://api.example.com",
    "https://operator:secret-value@api.example.com",
    "https://api.example.com/v1",
    "https://api.example.com?token=secret-value",
    "https://api.example.com#secret-value",
    "https://localhost",
    "https://preview.localhost",
    "https://127.0.0.1",
    "https://[::1]",
  ]) {
    assert.throws(
      () => createVercelConfig({ STACKLENS_API_ORIGIN: origin }),
      (error) =>
        error instanceof Error &&
        error.message.includes("HTTPS origin") &&
        !error.message.includes("secret-value"),
    );
  }
});

await test("FR-022: a separate browser API origin cannot bypass the prepared same-origin proxy", () => {
  assert.throws(
    () =>
      createVercelConfig({
        STACKLENS_API_ORIGIN: "https://api.example.com",
        VITE_STACKLENS_API_BASE_URL: "https://other.example.com",
      }),
    /Leave VITE_STACKLENS_API_BASE_URL unset/,
  );
});
