import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const directory = new URL("../.github/workflows/", import.meta.url);
const events = ["opened", "reopened", "synchronize", "ready_for_review", "converted_to_draft"];
// Events with PR-related payloads need an explicit policy before any jobs run.
// issue_comment also covers ordinary issues; it must be reviewed separately.
const prRelatedEvents = new Set([
  "pull_request",
  "pull_request_target",
  "pull_request_review",
  "pull_request_review_comment",
  "issue_comment",
]);
const gate =
  "github.event_name != 'pull_request' || " +
  "!github.event.pull_request.draft || " +
  "github.event.action == 'ready_for_review'";
const identity =
  "$" +
  "{{ github.event_name == 'pull_request' && github.event.pull_request.number || " +
  "github.event_name == 'push' && github.ref || github.run_id }}";
const configurations = {
  "quality.yml": {
    jobs: ["quality"],
    first: "quality",
    group: "quality-" + "$" + "{{ github.workflow }}-" + identity,
    labels: {},
  },
  "offsite-backup-fixture.yml": {
    jobs: ["capture", "verify"],
    first: "capture",
    group: "offsite-backup-fixture-" + identity,
    labels: {
      capture: "Offsite fixture / capture",
      verify: "Offsite fixture / verify",
    },
  },
  "portable-recovery.yml": {
    jobs: ["capture", "recover"],
    first: "capture",
    group: "portable-recovery-" + identity,
    labels: {
      capture: "Portable recovery / capture",
      recover: "Portable recovery / restore",
    },
  },
};
const read = (file) => readFileSync(new URL(file, directory), "utf8").replaceAll("\r\n", "\n");

// Inspect a section at its actual indentation level, not matching a step or comment.
function block(text, name, indent) {
  const lines = text.split("\n");
  const start = lines.indexOf(" ".repeat(indent) + name + ":");
  assert.notEqual(start, -1, "Missing " + name + " section");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (!lines[i].trim() || lines[i].trimStart().startsWith("#")) {
      continue;
    }
    if (lines[i].length - lines[i].trimStart().length <= indent) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}
// Fail closed on valid YAML forms this lightweight checker does not support.
function workflowEvents(source) {
  const headers = [...source.matchAll(/^on:/gm)];
  assert.equal(headers.length, 1, "Expected one block-style on: declaration");
  const events = block(source, "on", 0)
    .split("\n")
    .filter((line) => /^ {2}\S/.test(line) && !line.trimStart().startsWith("#"));
  assert.ok(events.length > 0, "At least one workflow event is required");
  for (const declaration of events) {
    assert.match(
      declaration,
      /^ {2}[a-z_][a-z_0-9-]*:$/,
      "Unsupported event trigger syntax; use a block-style on: mapping",
    );
  }
  return events.map((line) => line.trim().slice(0, -1));
}

function relatedEvents(source) {
  return workflowEvents(source).filter((event) => prRelatedEvents.has(event));
}

function reviewedWorkflowInventory(filenames, readSource) {
  return filenames.filter((filename) => relatedEvents(readSource(filename)).length > 0);
}

function assertReadOnlyPermissions(source) {
  assert.equal(
    [...source.matchAll(/^permissions:/gm)].length,
    1,
    "Expected one top-level permissions declaration",
  );
  const entries = block(source, "permissions", 0)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(entries, ["contents: read"], "Unsupported workflow-level permissions");
  assert.doesNotMatch(
    block(source, "jobs", 0),
    /^ {4}permissions:/m,
    "Unexpected job-level permission override",
  );
}

function value(text, key, indent) {
  const match = text.match(new RegExp("^ {" + indent + "}" + key + ": (.+)$", "m"));
  assert.ok(match, "Missing " + key + " at indentation " + indent);
  return match[1];
}
function condition(job) {
  const match = job.match(/^ {4}if: >-\n((?:^ {6}.+(?:\n|$))+)/m);
  assert.ok(match, "A job-level draft guard is required");
  return match[1].trim().replace(/\s+/g, " ");
}

test("all PR-related workflow event sources require reviewed policy", () => {
  const actual = reviewedWorkflowInventory(
    readdirSync(directory).filter((name) => /\.ya?ml$/.test(name)),
    read,
  );
  assert.deepEqual(actual.sort(), Object.keys(configurations).sort());
});
for (const [filename, config] of Object.entries(configurations)) {
  test(filename + " preserves lifecycle, job dependencies and concurrency", () => {
    const source = read(filename);
    assert.deepEqual(
      relatedEvents(source),
      ["pull_request"],
      "Additional PR-related event requires a separately reviewed workflow policy",
    );
    const on = block(source, "on", 0);
    const pr = block(on, "pull_request", 2);
    const activity = pr.match(/^ {4}types: \[([^\]]+)\]$/m);
    assert.ok(activity, "PR lifecycle types must be explicit");
    assert.deepEqual(activity[1].split(",").map((type) => type.trim()), events);
    assert.match(block(on, "push", 2), /^ {4}branches:(?: \[main\]|\n {6}- main)$/m);
    const concurrency = block(source, "concurrency", 0);
    assert.equal(value(concurrency, "group", 2), config.group);
    assert.equal(
      value(concurrency, "cancel-in-progress", 2),
      "$" + "{{ github.event_name == 'pull_request' }}",
    );
    assertReadOnlyPermissions(source);
    const jobs = block(source, "jobs", 0);
    const actualJobs = [...jobs.matchAll(/^ {2}([a-z][a-z-]*):$/gm)].map((match) => match[1]);
    assert.deepEqual(actualJobs, config.jobs);
    assert.equal(condition(block(jobs, config.first, 2)), gate);
    for (const [jobName, label] of Object.entries(config.labels)) {
      const job = block(jobs, jobName, 2);
      assert.equal(value(job, "name", 4), label);
      if (jobName !== "capture") {
        assert.equal(value(job, "needs", 4), "capture");
        assert.doesNotMatch(job, /^ {4}if:/m);
      }
    }
  });
}
test("fixture and recovery check names are unique", () => {
  const labels = Object.values(configurations).flatMap((config) => Object.values(config.labels));
  assert.equal(new Set(labels).size, labels.length);
});

test("unsupported inline PR triggers cannot bypass inventory", () => {
  assert.throws(
    () => workflowEvents("name: unsafe\non: [pull_request]\njobs:\n"),
    /Missing on section/,
  );
  assert.throws(
    () => workflowEvents("on:\n  pull_request: { types: [opened] }\n"),
    /Unsupported event trigger syntax/,
  );
});

test("extra token grants and job-level overrides fail closed", () => {
  const safe = read("quality.yml");
  assertReadOnlyPermissions(safe);
  assert.throws(
    () => assertReadOnlyPermissions(safe.replace(
      "  contents: read",
      "  contents: read\n  actions: write",
    )),
    /Unsupported workflow-level permissions/,
  );
  assert.throws(
    () => assertReadOnlyPermissions(safe.replace(
      "    runs-on: ubuntu-latest",
      "    permissions:\n      contents: write\n    runs-on: ubuntu-latest",
    )),
    /Unexpected job-level permission override/,
  );
});

test("review, target and issue comment events are visible to the inventory", () => {
  const approved = Object.keys(configurations);
  const extra = "unreviewed.yml";
  for (const event of prRelatedEvents) {
    const actual = reviewedWorkflowInventory(
      [...approved, extra],
      (filename) => filename === extra ? `on:\n  ${event}:\n` : read(filename),
    );
    assert.deepEqual(actual.sort(), [...approved, extra].sort());
  }
});
