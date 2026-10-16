import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const callbackLandingPath = "/auth/github/complete.html";
const html = readFileSync(
  new URL("../apps/web/public/auth/github/complete.html", import.meta.url),
  "utf8",
);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gu)];
if (scripts.length !== 1)
  throw new Error("The isolated callback must have exactly one inline script.");
// HTML parsing normalizes CRLF/CR before hashing inline script text, including Windows checkouts.
const hash = createHash("sha256").update(scripts[0][1].replace(/\r\n?/gu, "\n")).digest("base64");

/** Exact inline hash binds the isolated document to its reviewed script. No telemetry reports. */
export const callbackLandingHeaders = [
  {
    key: "Content-Security-Policy",
    value: `default-src 'none'; script-src 'sha256-${hash}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`,
  },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cache-Control", value: "private, no-store" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "no-store" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
