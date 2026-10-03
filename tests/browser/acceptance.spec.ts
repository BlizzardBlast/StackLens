import { expect, test, type Page } from "@playwright/test";

import { reportV2Fixture } from "../../apps/web/src/features/analysis-report/v2-test-fixture";
import { createRepositoryReportFixture } from "../../apps/web/src/features/repository-analysis/test-fixture";

const repositoryUrl = "https://github.com/BlizzardBlast/StackLens";
const analysisId = "analysis-web-001";
const report = createRepositoryReportFixture();
const currentReport = reportV2Fixture();

test.beforeEach(async ({ page }) => {
  // All API calls stay synthetic, including unexpected ones. A test cannot submit a live job.
  await page.route("**/v1/**", (route) =>
    route.fulfill({
      status: 500,
      json: { code: "unexpected_request", message: "Unexpected test API request." },
    }),
  );
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
});

async function expectNoOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport);
}

test("FR-003/004/017, NFR-006/007/008: repository stages, report, evidence focus and terminal polling", async ({
  page,
}) => {
  let complete = false;
  let reads = 0;
  await page.route("**/v1/analyses/repository", (route) =>
    route.fulfill({ status: 202, json: { analysisId } }),
  );
  await page.route(`**/v1/analyses/${analysisId}`, (route) => {
    reads++;
    return route.fulfill({
      json: {
        analysisId,
        repositoryUrl,
        status: complete ? "completed_with_limitations" : "running",
        progressStage: complete ? "completed_with_limitations" : "resolving_repository",
        createdAt: "2026-10-03T01:00:00Z",
        updatedAt: "2026-10-03T01:00:01Z",
        ...(complete ? { report: currentReport } : {}),
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Public GitHub repository").fill(repositoryUrl);
  await page.getByRole("button", { name: "Analyze repository", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Analyzing repository" })).toBeVisible();
  const stages = page.getByRole("list", { name: "Analysis stages" });
  await expect(stages.getByRole("listitem")).toHaveCount(6);
  // Measure actual layout, especially the long metadata title that formerly displaced Waiting.
  const geometry = await stages.getByRole("listitem").evaluateAll((items) =>
    items.map((item) => {
      const row = item.querySelector("div > div");
      const [title, status] = row?.querySelectorAll("span") ?? [];
      if (!title || !status) throw new Error("Stage row labels missing");
      const titleBox = title.getBoundingClientRect();
      const statusBox = status.getBoundingClientRect();
      return {
        right: statusBox.right,
        gap: statusBox.left - titleBox.right,
        top: statusBox.top - titleBox.top,
      };
    }),
  );
  const rightEdges = geometry.map((row) => row.right);
  expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThan(1);
  for (const row of geometry) {
    expect(row.gap).toBeGreaterThanOrEqual(7);
    expect(Math.abs(row.top)).toBeLessThan(4);
  }
  await expectNoOverflow(page);
  complete = true;
  await expect(page.getByRole("heading", { name: "Analysis report", exact: true })).toBeVisible();
  const trigger = page.getByRole("button", { name: /View evidence/ }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const evidence = page.getByRole("complementary", { name: "Confirmed package issue" });
  await expect(evidence).toBeVisible();
  await expect(evidence.getByRole("heading", { name: "Confirmed package issue" })).toBeFocused();
  await evidence.getByRole("button", { name: "Close", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expectNoOverflow(page);
  const terminalReads = reads;
  // Wait longer than two polling intervals; changing state only happened through real fetches.
  await page.waitForTimeout(3200);
  expect(reads).toBe(terminalReads);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Analysis report", exact: true })).toBeVisible();
});

test("FR-002/021, NFR-006/007: invalid manifest correction and native file replacement", async ({
  page,
}) => {
  const submissions: unknown[] = [];
  await page.route("**/v1/analyze/manifest", (route) => {
    const input = route.request().postDataJSON();
    submissions.push(input);
    return route.fulfill(
      input.content === "{"
        ? {
            status: 400,
            json: { code: "invalid_json", message: "Manifest content must be valid JSON." },
          }
        : {
            json: {
              report: {
                ...report,
                input: { type: "manifest", fingerprint: "sha256:browser-test" },
              },
            },
          },
    );
  });
  await page.goto("/quick");
  const content = page.getByLabel("package.json content", { exact: true });
  await content.fill("{");
  await page.getByRole("button", { name: "Run quick analysis" }).click();
  await expect(page.getByRole("alert")).toHaveText("Manifest content must be valid JSON.");
  await expect(content).toHaveValue("{");
  await expect(content).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("radio", { name: "Choose local file", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio", { name: "Choose local file", exact: true })).toBeChecked();
  const file = page.getByLabel("Local package.json", { exact: true });
  await file.setInputFiles({
    name: "package.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"name":"first"}'),
  });
  await expect(page.getByText(/ready for analysis/)).toBeVisible();
  const replacement = '{"name":"replacement","dependencies":{"react":"19.0.0"}}';
  await file.setInputFiles({
    name: "package.json",
    mimeType: "application/json",
    buffer: Buffer.from(replacement),
  });
  await expect(
    page.getByText(`${Buffer.byteLength(replacement)} B ready for analysis`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run quick analysis" }).click();
  await expect(page.getByRole("heading", { name: "Analysis report", exact: true })).toBeFocused();
  expect(submissions).toEqual([
    { kind: "paste", content: "{" },
    { kind: "upload", filename: "package.json", content: replacement },
  ]);
  await expectNoOverflow(page);
});

test("FR-004/022, NFR-008: missing analysis stops polling and keeps manual recovery", async ({
  page,
}) => {
  let reads = 0;
  await page.route(`**/v1/analyses/${analysisId}`, (route) => {
    reads++;
    return route.fulfill({
      status: 404,
      json: { code: "analysis_not_found", message: "Analysis was not found." },
    });
  });
  await page.goto(`/analyses/${analysisId}`);
  await expect(page.getByRole("alert")).toContainText("Analysis was not found.");
  await page.waitForTimeout(3200);
  expect(reads).toBe(1);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(() => reads).toBe(2);
  await page.waitForTimeout(1700);
  expect(reads).toBe(2);
  await expectNoOverflow(page);
});
