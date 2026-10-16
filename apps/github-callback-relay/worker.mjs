/** FR-100, SEC-003/007: fixed, credential-free transport. No runtime bindings or I/O. */
const landing = "https://stacklens-web.vercel.app/auth/github/complete.html";
const limits = { code: 256, state: 256, error: 256, error_description: 2_000, error_uri: 2_000 };
const headers = {
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
};

export default {
  /** @param {Request} request */
  fetch(request) {
    const url = new URL(request.url);
    const response = (status, extra = {}) =>
      new Response(null, { status, headers: { ...headers, ...extra } });
    if (url.protocol !== "https:" || url.username || url.password) return response(400);
    if (request.method !== "GET") return response(405, { allow: "GET" });
    if (url.pathname === "/health" && !url.search) return response(204);
    if (url.pathname !== "/v1/auth/github/callback") return response(404);
    if (request.url.length > 8_192) return response(400);
    const fields = new Map();
    for (const [name, value] of url.searchParams) {
      if (!Object.hasOwn(limits, name) || fields.has(name) || value.length > limits[name])
        return response(400);
      fields.set(name, value);
    }
    const fragment = new URLSearchParams();
    if (fields.has("error")) {
      // Provider descriptions/URIs never leave the relay or influence navigation.
      fragment.set("error", "authorization_denied");
    } else {
      if (
        !/^[A-Za-z0-9_-]{1,256}$/u.test(fields.get("code") ?? "") ||
        !/^[A-Za-z0-9_-]{43}$/u.test(fields.get("state") ?? "") ||
        fields.has("error_description") ||
        fields.has("error_uri")
      )
        return response(400);
      fragment.set("code", fields.get("code"));
    }
    if (fields.has("state")) {
      if (!/^[A-Za-z0-9_-]{43}$/u.test(fields.get("state"))) return response(400);
      fragment.set("state", fields.get("state"));
    }
    // Always include a fragment, including denials, to prevent fragment inheritance.
    return response(303, { location: `${landing}#${fragment}` });
  },
};
