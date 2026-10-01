// NFR-009/SEC-002: install only the reviewed StackLens runtime, never an analyzed repository.
// Run once with the archive SHA-256 as the sole argument, then use start-worker.js.
void Promise.all([import("node:fs"), import("node:crypto"), import("node:child_process")])
  .then(([fs, crypto, childProcess]) => {
    const expectedHash = process.argv[2];
    if (expectedHash === undefined || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new Error("Reviewed archive hash required");
    }

    const archive = "stacklens-worker-silly.tar.gz";
    const hash = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
    if (hash !== expectedHash) {
      throw new Error("Reviewed archive hash mismatch");
    }

    childProcess.execFileSync("tar", ["-xzf", archive, "-C", "."], { stdio: "ignore" });
    fs.unlinkSync(archive);
    process.stdout.write("Reviewed StackLens Worker runtime installed.\n");
  })
  .catch(() => {
    process.exitCode = 1;
    process.stderr.write("StackLens Worker runtime installation could not complete.\n");
  });
