import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";

import {
  callbackLandingHeaders,
  callbackLandingPath,
} from "../../scripts/github-callback-landing.mjs";

/** FR-100: test the same isolated document policy locally and on the generated Vercel target. */
const configureCallbackSecurity = (server: ViteDevServer | PreviewServer) => {
  server.middlewares.use((request, response, next) => {
    if (request.url?.split("?")[0] === callbackLandingPath) {
      for (const { key, value } of callbackLandingHeaders) response.setHeader(key, value);
    }
    next();
  });
};
function callbackLandingSecurity(): Plugin {
  return {
    name: "stacklens-callback-security",
    configureServer: configureCallbackSecurity,
    configurePreviewServer: configureCallbackSecurity,
  };
}

export default defineConfig({
  envDir: "../..",
  plugins: [callbackLandingSecurity(), react(), tailwindcss()],
  server: {
    proxy: {
      "/v1": "http://127.0.0.1:3000",
    },
  },
});
