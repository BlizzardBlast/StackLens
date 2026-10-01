// NFR-009/SEC-007: runtime credentials live outside the uploaded application archive.
// This file must run in both the panel's CommonJS entry context and Node's ESM context.
try {
  process.loadEnvFile("runtime.env");
  process.env.NODE_ENV = "production";
} catch {
  process.exitCode = 1;
  process.stderr.write("StackLens Worker runtime configuration could not be loaded.\n");
}

if (process.exitCode !== 1) {
  void import("./dist/main.js").catch(() => {
    process.exitCode = 1;
    process.stderr.write("StackLens Worker entrypoint could not be loaded.\n");
  });
}
