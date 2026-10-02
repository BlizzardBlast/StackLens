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
  try {
    // The panel's quoted "*.js" test sends ordinary JavaScript through ts-node. Replace
    // the loader process before opening database connections; preserve PID and stdio.
    // No repository under analysis is executed here.
    if (process.platform === "linux" && process.execArgv.some((arg) => arg.includes("ts-node"))) {
      process.execve(
        process.execPath,
        [process.execPath, "--max-old-space-size=96", "./dist/main.js"],
        process.env,
      );
    } else {
      void import("./dist/main.js").catch(() => {
        process.exitCode = 1;
        process.stderr.write("StackLens Worker entrypoint could not be loaded.\n");
      });
    }
  } catch {
    process.exitCode = 1;
    process.stderr.write("StackLens Worker native startup failed.\n");
  }
}
