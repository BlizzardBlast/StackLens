import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { expect, test } from "@playwright/test";

import { callbackLandingHeaders } from "../../scripts/github-callback-landing.mjs";

const path = "/auth/github/complete.html";
const code = "synthetic-callback-code";
const state = "s".repeat(43);

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/**", (route) => route.fulfill({ json: { enabled: false } }));
});

test("FR-100/SEC-007: real cross-site return preserves Lax cookie and Origin on the wire", async ({
  page,
}) => {
  // WebKit interception omits Cookie headers and cannot fulfill 303. Use two owned HTTP servers.
  await page.unroute("**/v1/**");
  const html = readFileSync(
    new URL("../../apps/web/dist/auth/github/complete.html", import.meta.url),
    "utf8",
  );
  let webOrigin = "",
    relayOrigin = "";
  const received: {
    method: string | undefined;
    cookie: string | undefined;
    origin: string | undefined;
    referer: string | undefined;
    body: string;
  }[] = [];
  const relay = createServer((_request, response) => {
    response.writeHead(303, {
      location: `${webOrigin}${path}#code=${code}&state=${state}`,
      "referrer-policy": "no-referrer",
    });
    response.end();
  });
  const web = createServer((request, response) => {
    if (request.url === "/start") {
      response.writeHead(200, {
        "content-type": "text/html",
        "set-cookie": "stacklens_oauth=synthetic-pending-cookie; Path=/; HttpOnly; SameSite=Lax",
      });
      response.end(`<a href="${relayOrigin}/relay">Continue on the owned relay</a>`);
    } else if (request.url === path) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        ...Object.fromEntries(callbackLandingHeaders.map(({ key, value }) => [key, value])),
      });
      response.end(html);
    } else if (request.url === "/v1/auth/github/callback") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => {
        body += chunk;
      });
      request.on("end", () => {
        received.push({
          method: request.method,
          cookie: request.headers.cookie,
          origin: request.headers.origin,
          referer: request.headers.referer,
          body,
        });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ connected: true }));
      });
    } else {
      response.writeHead(200, { "content-type": "text/html" });
      response.end("<h1>Returned</h1>");
    }
  });
  try {
    web.listen(0, "127.0.0.1");
    await once(web, "listening");
    relay.listen(0, "127.0.0.1");
    await once(relay, "listening");
    const webAddress = web.address(),
      relayAddress = relay.address();
    if (
      !webAddress ||
      typeof webAddress === "string" ||
      !relayAddress ||
      typeof relayAddress === "string"
    )
      throw new Error("Missing owned HTTP ports.");
    webOrigin = `http://127.0.0.1:${webAddress.port}`;
    relayOrigin = `http://localhost:${relayAddress.port}`;
    await page.goto(`${webOrigin}/start`);
    await page.getByRole("link", { name: "Continue on the owned relay" }).click();
    await expect(page).toHaveURL(`${webOrigin}/?github=connected`);
    expect(received).toEqual([
      {
        method: "POST",
        cookie: "stacklens_oauth=synthetic-pending-cookie",
        origin: webOrigin,
        referer: `${webOrigin}${path}`,
        body: JSON.stringify({ code, state }),
      },
    ]);
  } finally {
    await Promise.all(
      [web, relay].map(async (server) => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }),
    );
  }
});

test("FR-100/SEC-007: clear before the sole POST, fixed completion and no replay on back/reload", async ({
  page,
}) => {
  const urls: string[] = [];
  const consoleErrors: string[] = [];
  const errors: string[] = [];
  let callbacks = 0;
  page.on("request", (request) => urls.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/quick");
  await page.route("**/v1/auth/github/callback", async (route) => {
    callbacks++;
    expect(await page.evaluate(() => ({ hash: location.hash, search: location.search }))).toEqual({
      hash: "",
      search: "",
    });
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ code, state });
    expect(route.request().headers().referer).toBe(new URL(path, route.request().url()).href);
    await route.fulfill({ json: { connected: true } });
  });
  const response = await page.goto(`${path}#code=${code}&state=${state}`);
  expect(response?.headers()["content-security-policy"]).toContain("script-src 'sha256-");
  expect(response?.headers()["content-security-policy"]).not.toContain("unsafe-inline");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page).toHaveURL(/\/\?github=connected$/u);
  // Scope page-error assertions to the callback navigation, before app requests are cancelled by history tests.
  expect(errors).toEqual([]);
  expect(consoleErrors.filter((message) => message.includes("Content Security Policy"))).toEqual(
    [],
  );
  await page.reload();
  await page.goBack();
  expect(callbacks).toBe(1);
  for (const url of urls) {
    expect(url).not.toContain(code);
    expect(url).not.toContain(state);
  }
});

for (const invalid of [
  "missing",
  "duplicate",
  "unknown",
  "query",
  "oversized",
  "unsafe code",
] as const) {
  test(`FR-100/SEC-007: ${invalid} clears callback without POST`, async ({ page }) => {
    let callbacks = 0;
    await page.route("**/v1/auth/github/callback", (route) => {
      callbacks++;
      return route.fulfill({ json: { connected: true } });
    });
    const hash =
      invalid === "missing"
        ? ""
        : invalid === "duplicate"
          ? `#code=${code}&state=${state}&code=other`
          : invalid === "unknown"
            ? `#code=${code}&state=${state}&return=https://evil.invalid`
            : invalid === "oversized"
              ? `#code=${"x".repeat(8_193)}&state=${state}`
              : invalid === "unsafe code"
                ? `#code=%0a&state=${state}`
                : `#code=${code}&state=${state}`;
    await page.goto(`${path}${invalid === "query" ? "?code=synthetic" : ""}${hash}`);
    await expect(page).toHaveURL(/\/\?github=error$/u);
    expect(callbacks).toBe(0);
  });
}

test("FR-100/SEC-007: denial and network failure use fixed error notice without leaking fields", async ({
  page,
}) => {
  let callbacks = 0;
  await page.route("**/v1/auth/github/callback", (route) => {
    callbacks++;
    expect(route.request().postDataJSON()).toEqual({ error: "authorization_denied", state });
    return route.abort();
  });
  await page.goto(`${path}#error=authorization_denied&state=${state}`);
  await expect(page).toHaveURL(/\/\?github=error$/u);
  expect(callbacks).toBe(1);
});

test("FR-100/NFR-006/007: no-script fallback is labeled and loads no callback resources", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    ...(baseURL ? { baseURL } : {}),
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  try {
    await page.goto(`${path}#code=${code}&state=${state}`);
    await expect(page.getByRole("heading", { name: "Connecting GitHub" })).toBeVisible();
    await expect(
      page.getByText("JavaScript is required to finish connecting GitHub."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "return to StackLens" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toContain(code);
  } finally {
    await context.close();
  }
});
