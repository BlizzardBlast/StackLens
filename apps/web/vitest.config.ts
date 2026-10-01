import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Large report DOMs contend for CPU when every file starts a jsdom worker at once.
    maxWorkers: 2,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
  },
});
