const rulesEntry = new URL(
  "../packages/rules-javascript/dist/advisory-severity.js",
  import.meta.url,
);

await import(rulesEntry.href);

const databaseUrl = process.env.TEST_DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  process.stdout.write(
    "Compiled rules runtime smoke passed; database runtime smoke skipped (TEST_DATABASE_URL is unset).\n",
  );
  process.exit(0);
}

const { createStackLensApiRuntime } = await import("../apps/api/dist/index.js");
const { createVercelApiRuntime } = await import("../apps/api/dist/vercel-runtime.js");
const { startStackLensWorker } = await import("../apps/worker/dist/index.js");
const { default: assert } = await import("node:assert/strict");
const { spawn } = await import("node:child_process");
const { fileURLToPath } = await import("node:url");

await new Promise((resolve, reject) => {
  const entrySmoke = spawn(
    process.execPath,
    [fileURLToPath(new URL("./vercel-entry-smoke.mjs", import.meta.url))],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl, STACKLENS_DATABASE_SSL_CA: undefined },
      stdio: "inherit",
      timeout: 30_000,
    },
  );
  entrySmoke.once("error", reject);
  entrySmoke.once("exit", (code) =>
    code === 0 ? resolve() : reject(new Error("Native Vercel entry smoke failed.")),
  );
});

let apiRuntime;
let workerRuntime;
let vercelRuntime;

try {
  apiRuntime = await createStackLensApiRuntime({ connectionString: databaseUrl, logger: false });
  workerRuntime = await startStackLensWorker({
    connectionString: databaseUrl,
    concurrency: 1,
    retentionCleanup: false,
    // Register only a smoke-local task so the runner initializes without claiming repository jobs
    // or constructing the provider-backed analyzer task.
    taskList: { runtime_smoke: async () => undefined },
  });
  // FR-003/022, SEC-003: exercise the compiled request-bound adapter with real persistence,
  // without a recovery timer or provider task. Functions still await submission dispatch.
  vercelRuntime = await createVercelApiRuntime({ DATABASE_URL: databaseUrl });
  const submitted = await vercelRuntime.app.inject({
    method: "POST",
    url: "/v1/analyses/repository",
    payload: { repositoryUrl: "https://github.com/acme/vercel-runtime-smoke" },
  });
  assert.equal(submitted.statusCode, 202);
  const { analysisId } = submitted.json();
  const status = await vercelRuntime.app.inject({
    method: "GET",
    url: `/v1/analyses/${analysisId}`,
  });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().status, "queued");
  assert.match(status.headers["cache-control"], /no-store/);
  const quick = await vercelRuntime.app.inject({
    method: "POST",
    url: "/v1/analyze/manifest",
    payload: { kind: "paste", content: '{"name":"vercel-runtime-smoke"}' },
  });
  assert.equal(quick.statusCode, 200);
  const lookup = await vercelRuntime.app.inject({
    method: "GET",
    url: `/v1/analyses/${quick.json().report.analysisId}`,
  });
  assert.equal(lookup.statusCode, 404);
} finally {
  await vercelRuntime?.stop();
  await workerRuntime?.stop();
  await apiRuntime?.stop();
}

process.stdout.write(
  "Compiled API, request-bound Vercel adapter and Worker runtime smoke passed.\n",
);
