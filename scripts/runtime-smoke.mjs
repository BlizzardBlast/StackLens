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
const { startStackLensWorker } = await import("../apps/worker/dist/index.js");

let apiRuntime;
let workerRuntime;

try {
  apiRuntime = await createStackLensApiRuntime({ connectionString: databaseUrl, logger: false });
  workerRuntime = await startStackLensWorker({
    connectionString: databaseUrl,
    concurrency: 1,
    // Register only a smoke-local task so the runner initializes without claiming repository jobs
    // or constructing the provider-backed analyzer task.
    taskList: { runtime_smoke: async () => undefined },
  });
} finally {
  await workerRuntime?.stop();
  await apiRuntime?.stop();
}

process.stdout.write("Compiled API and Worker runtime smoke passed.\n");
