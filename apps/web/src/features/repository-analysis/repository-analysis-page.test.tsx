import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportV2Fixture } from "../analysis-report/v2-test-fixture.js";
import {
  RepositoryAnalysisApiError,
  type RepositoryAnalysisClient,
  type RepositoryAnalysisSnapshot,
} from "./repository-analysis-api.js";
import { RepositoryAnalysisPage } from "./repository-analysis-page.js";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const running: RepositoryAnalysisSnapshot = {
  analysisId: "poll-test",
  repositoryUrl: "https://github.com/example/project",
  status: "running",
  progressStage: "collecting_metadata",
  createdAt: "2026-09-29T00:00:00Z",
  updatedAt: "2026-09-29T00:00:00Z",
};
const missing = () => new RepositoryAnalysisApiError("not_found", "Analysis not found.", 404);
let queryClient: QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retryDelay: 10 } },
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
});
async function tick(ms = 1) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function mount(getAnalysis: RepositoryAnalysisClient["getAnalysis"]) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RepositoryAnalysisPage
        analysisId="poll-test"
        client={{
          getAnalysis,
          submitRepository: vi.fn<RepositoryAnalysisClient["submitRepository"]>(),
        }}
      />
    </QueryClientProvider>,
  );
}
async function focusAndReconnect() {
  await act(async () => {
    focusManager.setFocused(false);
    onlineManager.setOnline(false);
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
  });
  await tick();
}

describe("repository polling [FR-003, FR-022, NFR-008]", () => {
  it.each([false, true])(
    "stops all automatic 404 refetches with cached data=%s",
    async (cached) => {
      if (cached) queryClient.setQueryData(["repository-analysis", "poll-test"], running);
      const get = vi.fn<RepositoryAnalysisClient["getAnalysis"]>().mockRejectedValue(missing());
      mount(get);
      await tick();
      expect(screen.getByRole("alert")).toHaveTextContent("Analysis not found");
      expect(get).toHaveBeenCalledTimes(1);
      await tick(10000);
      await focusAndReconnect();
      await tick(10000);
      expect(get).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    },
  );

  it("resumes polling after successful manual recovery and stops at terminal status", async () => {
    const get = vi
      .fn<RepositoryAnalysisClient["getAnalysis"]>()
      .mockRejectedValueOnce(missing())
      .mockResolvedValueOnce(running)
      .mockResolvedValue({
        ...running,
        status: "failed",
        progressStage: "failed",
        failure: { code: "test", message: "Finished.", retryable: false },
      });
    mount(get);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await tick();
    expect(screen.getByText("Analysis in progress")).toBeInTheDocument();
    await tick(1500);
    expect(get).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("alert")).toHaveTextContent("Analysis failed");
    await tick(10000);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("keeps repeated manual 404 failures stopped", async () => {
    const get = vi.fn<RepositoryAnalysisClient["getAnalysis"]>().mockRejectedValue(missing());
    mount(get);
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await tick();
    await focusAndReconnect();
    await tick(10000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("retains automatic retry and polling after a transient failure", async () => {
    const get = vi
      .fn<RepositoryAnalysisClient["getAnalysis"]>()
      .mockRejectedValueOnce(new RepositoryAnalysisApiError("unavailable", "Retry later.", 503))
      .mockResolvedValue(running);
    mount(get);
    await tick(20);
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Analysis in progress")).toBeInTheDocument();
    await tick(1500);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("NFR-008 recovers from a transient 503 to a v2 report and stops interval polling", async () => {
    const report = { ...reportV2Fixture(), analysisId: "poll-test" };
    const get = vi
      .fn<RepositoryAnalysisClient["getAnalysis"]>()
      .mockRejectedValueOnce(new RepositoryAnalysisApiError("unavailable", "Retry later.", 503))
      .mockResolvedValue({
        ...running,
        status: "completed_with_limitations",
        progressStage: "completed_with_limitations",
        report,
      });
    mount(get);
    await tick(20);
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Analysis report", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Analysis completed with limitations")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    await tick(10000);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each(["completed", "completed_with_limitations", "failed"] as const)(
    "does not poll %s",
    async (status) => {
      const get = vi
        .fn<RepositoryAnalysisClient["getAnalysis"]>()
        .mockResolvedValue({ ...running, status, progressStage: status });
      mount(get);
      await tick();
      await tick(10000);
      expect(get).toHaveBeenCalledTimes(1);
    },
  );

  it("forwards the query signal and cancels an in-flight request on unmount", async () => {
    const get = vi.fn<RepositoryAnalysisClient["getAnalysis"]>(() => new Promise(() => {}));
    const view = mount(get);
    await tick();
    const signal = get.mock.calls[0]?.[1];
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await tick(10000);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
