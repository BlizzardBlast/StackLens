import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../..",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/v1": "http://127.0.0.1:3000",
    },
  },
});
