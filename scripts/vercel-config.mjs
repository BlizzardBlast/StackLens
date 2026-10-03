/**
 * Prepare the static web target without moving the API or Worker into Vercel Functions.
 * Supports FR-001/003/004/022, NFR-008/009 and SEC-003/007 under ADR-0002/0004.
 * @param {Record<string, string | undefined>} environment
 */
export function createVercelConfig(environment) {
  const rawOrigin = environment.STACKLENS_API_ORIGIN?.trim();
  const originError =
    "STACKLENS_API_ORIGIN must be a non-loopback HTTPS origin without credentials, path, query or fragment.";

  if (!rawOrigin) {
    throw new Error(originError);
  }

  let apiUrl;

  try {
    apiUrl = new URL(rawOrigin);
  } catch {
    throw new Error(originError);
  }

  if (
    apiUrl.protocol !== "https:" ||
    apiUrl.username !== "" ||
    apiUrl.password !== "" ||
    apiUrl.href !== `${apiUrl.origin}/` ||
    apiUrl.hostname === "localhost" ||
    apiUrl.hostname.endsWith(".localhost") ||
    apiUrl.hostname.startsWith("127.") ||
    apiUrl.hostname === "[::1]"
  ) {
    throw new Error(originError);
  }

  if (environment.VITE_STACKLENS_API_BASE_URL?.trim()) {
    throw new Error(
      "Leave VITE_STACKLENS_API_BASE_URL unset for the Vercel same-origin API proxy.",
    );
  }

  const noStoreHeaders = [
    { key: "Cache-Control", value: "private, no-store" },
    { key: "CDN-Cache-Control", value: "no-store" },
    { key: "Vercel-CDN-Cache-Control", value: "no-store" },
  ];

  return {
    framework: "vite",
    installCommand: "pnpm install --frozen-lockfile",
    buildCommand: "pnpm exec turbo run build --filter=@stacklens/web...",
    outputDirectory: "apps/web/dist",
    rewrites: [
      { source: "/v1/:path*", destination: `${apiUrl.origin}/v1/:path*` },
      { source: "/openapi.json", destination: `${apiUrl.origin}/openapi.json` },
      { source: "/quick", destination: "/index.html" },
      { source: "/analyses/:analysisId", destination: "/index.html" },
    ],
    headers: [
      { source: "/v1/:path*", headers: noStoreHeaders },
      { source: "/openapi.json", headers: noStoreHeaders },
    ],
  };
}
