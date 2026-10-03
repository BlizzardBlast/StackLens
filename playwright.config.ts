import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 1,
  timeout: 30_000,
  reporter: [["list"], ["json", { outputFile: ".cache/playwright/results.json" }]],
  outputDir: ".cache/playwright/artifacts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    contextOptions: { reducedMotion: "reduce" },
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: (["chromium", "firefox", "webkit"] as const).flatMap((browserName) =>
    [
      { name: "desktop", viewport: { width: 1280, height: 900 } },
      { name: "narrow", viewport: { width: 320, height: 800 } },
    ].map(({ name, viewport }) => ({
      name: `${browserName}-${name}`,
      use: { browserName, viewport },
    })),
  ),
  webServer: {
    command:
      "pnpm --filter @stacklens/web exec vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
