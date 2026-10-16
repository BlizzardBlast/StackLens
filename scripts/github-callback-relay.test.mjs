import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import relay from "../apps/github-callback-relay/worker.mjs";

const origin = "https://relay.example";
const path = "/v1/auth/github/callback";
const state = "s".repeat(43);
const code = "synthetic-one-time-code";
function request(query, options) {
  return relay.fetch(new Request(`${origin}${path}?${query}`, options));
}

await test("FR-100/SEC-007: fixed query-free landing, empty responses and no provider error detail", async () => {
  const success = request(new URLSearchParams({ code, state }));
  assert.equal(success.status, 303);
  const location = new URL(success.headers.get("location"));
  assert.equal(location.origin, "https://stacklens-web.vercel.app");
  assert.equal(location.pathname, "/auth/github/complete.html");
  assert.equal(location.search, "");
  assert.deepEqual(Object.fromEntries(new URLSearchParams(location.hash.slice(1))), {
    code,
    state,
  });
  const denied = request(
    new URLSearchParams({
      error: "access_denied",
      state,
      error_description: "private-provider-message",
      error_uri: "https://evil.invalid/target",
    }),
  );
  assert.equal(denied.status, 303);
  assert.equal(
    new URL(denied.headers.get("location")).hash,
    `#error=authorization_denied&state=${state}`,
  );
  assert.equal(request("error=access_denied").status, 303);
  assert.deepEqual(await Promise.all([success.text(), denied.text()]), ["", ""]);
  for (const response of [success, denied]) {
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
});

await test("FR-100/SEC-002/007: malformed, duplicate, unknown and oversized callbacks never redirect", () => {
  for (const query of [
    "",
    `code=${code}`,
    `state=${state}`,
    `code=${code}&state=wrong`,
    `code=${code}&state=${state}&code=other`,
    `code=${code}&state=${state}&state=${state}`,
    `code=${code}&state=${state}&redirect_uri=https://evil.invalid`,
    `code=${code}&state=${state}&__proto__=value`,
    `code=${code}&state=${state}&constructor=x`,
    `code=${"x".repeat(257)}&state=${state}`,
    `code=%0a&state=${state}`,
    `error=denied&error_uri=${"x".repeat(2_001)}`,
    `error=denied&error_description=${"x".repeat(2_001)}`,
    `code=${code}&state=${state}&error_uri=unused`,
    `error=denied&state=wrong`,
    `error=denied&error_uri=${"%61".repeat(3_000)}`,
  ]) {
    const response = request(query);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("location"), null);
  }
  for (const method of ["POST", "PUT", "DELETE", "HEAD", "OPTIONS"]) {
    assert.equal(request(new URLSearchParams({ code, state }), { method }).status, 405);
  }
  assert.equal(
    relay.fetch(new Request(`http://relay.example${path}?code=${code}&state=${state}`)).status,
    400,
  );
  assert.equal(relay.fetch(new Request(`${origin}/unknown`)).status, 404);
  assert.equal(relay.fetch(new Request(`${origin}/health`)).status, 204);
});

await test("FR-100/SEC-007: relay artifact has no credential/runtime bindings and disables collection", () => {
  const config = JSON.parse(
    readFileSync(new URL("../apps/github-callback-relay/wrangler.json", import.meta.url)),
  );
  assert.equal(config.preview_urls, false);
  assert.deepEqual(config.observability, {
    enabled: false,
    logs: { enabled: false, invocation_logs: false, persist: false },
    traces: { enabled: false, persist: false },
    issues: { enabled: false },
  });
  assert.equal(config.bindings, undefined);
  assert.equal(config.vars, undefined);
});
