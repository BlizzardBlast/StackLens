// Operator-only recovery, after proving the exact queue owner process has exited.
// Restore start-worker.js as the main file after this one-shot command finishes.
try {
  process.loadEnvFile("runtime.env");
  process.env.NODE_ENV = "production";
  if (process.platform === "linux" && process.execArgv.some((arg) => arg.includes("ts-node"))) {
    process.execve(
      process.execPath,
      [process.execPath, "./dist/recover.js", ...process.argv.slice(2)],
      process.env,
    );
  } else {
    void import("./dist/recover.js").catch(() => {
      process.exitCode = 1;
      process.stderr.write("StackLens recovery entrypoint could not be loaded.\n");
    });
  }
} catch {
  process.exitCode = 1;
  process.stderr.write("StackLens recovery runtime configuration could not be loaded.\n");
}
