import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { QuickManifestAnalysisInput } from "./quick-analysis-api.js";
import { QuickAnalysisForm } from "./quick-analysis-form.js";

describe("QuickAnalysisForm [FR-001, FR-002, FR-004, FR-022, NFR-006, NFR-007]", () => {
  it("names native mode radios from their visible titles and associates their descriptions", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    const paste = screen.getByRole("radio", { name: "Paste manifest" });
    const upload = screen.getByRole("radio", { name: "Choose local file" });
    expect(paste).toHaveAccessibleDescription(
      "Best when package.json is already open in your editor.",
    );
    expect(upload).toHaveAccessibleDescription(
      "Read package.json locally, then send only its text to StackLens.",
    );
    expect(paste).toBeChecked();
    fireEvent.click(upload);
    expect(upload).toBeChecked();
    expect(screen.getByLabelText("Local package.json")).toBeInTheDocument();
  });

  it("keeps explicit spacing between the input legend and mode choices", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    expect(screen.getByText("Choose your input")).toHaveClass("mb-3");
  });

  it("submits pasted manifest content without duplicating authoritative JSON validation", async () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("package.json content"), {
      target: { value: '{"name":"demo","dependencies":{"react":"^19.0.0"}}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "paste",
        content: '{"name":"demo","dependencies":{"react":"^19.0.0"}}',
      });
    });
  });

  it("reads a selected package.json locally and submits the JSON upload shape", async () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    const file = new File(['{"name":"demo"}'], "package.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve('{"name":"demo"}'),
    });

    fireEvent.change(screen.getByLabelText("Local package.json"), {
      target: { files: [file] },
    });

    expect(await screen.findByText("package.json")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "upload",
        filename: "package.json",
        content: '{"name":"demo"}',
      });
    });
  });

  it("preserves pasted content when Fastify returns an authoritative validation error", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { rerender } = render(<QuickAnalysisForm onSubmit={onSubmit} />);
    const textarea = screen.getByLabelText("package.json content");

    fireEvent.change(textarea, {
      target: { value: '{"name": }' },
    });

    rerender(
      <QuickAnalysisForm onSubmit={onSubmit} serverError="package.json must contain valid JSON." />,
    );

    expect(textarea).toHaveValue('{"name": }');
    expect(screen.getByRole("alert")).toHaveTextContent("package.json must contain valid JSON.");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "manifest-content-help quick-analysis-error",
    );
    expect(textarea).toHaveAccessibleDescription(
      "StackLens inspects the manifest without running scripts or installing dependencies. package.json must contain valid JSON.",
    );
  });

  it("keeps paste help associated when a client validation error appears", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    const textarea = screen.getByLabelText("package.json content");
    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "manifest-content-help quick-analysis-error",
    );
    expect(textarea).toHaveAccessibleDescription(
      "StackLens inspects the manifest without running scripts or installing dependencies. Paste package.json content before running quick analysis.",
    );
  });

  it("keeps file help associated during client and server errors", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { rerender } = render(<QuickAnalysisForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));

    const fileInput = screen.getByLabelText("Local package.json");
    expect(fileInput).toHaveAttribute(
      "aria-describedby",
      "manifest-file-help quick-analysis-error",
    );
    expect(fileInput).toHaveAccessibleDescription(
      "Choose a JSON file named package.json. Choose a package.json file before running quick analysis.",
    );

    fireEvent.change(fileInput, { target: { files: [] } });

    rerender(
      <QuickAnalysisForm onSubmit={onSubmit} serverError="package.json must contain valid JSON." />,
    );

    expect(fileInput).toHaveAttribute(
      "aria-describedby",
      "manifest-file-help quick-analysis-error",
    );
    expect(fileInput).toHaveAccessibleDescription(
      "Choose a JSON file named package.json. package.json must contain valid JSON.",
    );
  });

  it("exposes a synchronous accessible busy state without fake progress", () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);

    render(<QuickAnalysisForm onSubmit={onSubmit} isPending />);

    expect(screen.getByLabelText("package.json content")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Analyzing manifest" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Analyzing package.json");
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analyzing manifest" }).closest("form"),
    ).toHaveAttribute("aria-busy", "true");
  });
});

function deferredFile(name = "package.json") {
  let resolve!: (content: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const file = new File(["{}"], name, { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => promise });
  return { file, resolve, reject };
}

function selectFile(file?: File) {
  fireEvent.change(screen.getByLabelText("Local package.json"), {
    target: { files: file ? [file] : [] },
  });
}

describe("local file generations [FR-002, FR-022, NFR-006]", () => {
  it("invalidates A immediately while B reads, including direct form submission", async () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(<QuickAnalysisForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    const a = deferredFile();
    selectFile(a.file);
    await act(async () => a.resolve('{"name":"A"}'));
    const b = deferredFile();
    selectFile(b.file);
    const submit = screen.getByRole("button", { name: "Run quick analysis" });
    expect(submit).toBeDisabled();
    expect(screen.getByLabelText("Local package.json").closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Reading file");
    expect(screen.getByLabelText("Local package.json")).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Paste manifest/ })).toBeEnabled();
    fireEvent.submit(submit.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => b.resolve('{"name":"B"}'));
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      kind: "upload",
      filename: "package.json",
      content: '{"name":"B"}',
    });
  });

  it.each(["resolve", "reject"] as const)(
    "ignores an obsolete read that later %ss",
    async (outcome) => {
      const onSubmit = vi
        .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
        .mockResolvedValue(undefined);
      render(<QuickAnalysisForm onSubmit={onSubmit} />);
      fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
      const a = deferredFile();
      const b = deferredFile();
      selectFile(a.file);
      selectFile(b.file);
      await act(async () => b.resolve('{"name":"B"}'));
      await act(async () => {
        if (outcome === "resolve") a.resolve('{"name":"A"}');
        else a.reject(new Error("obsolete"));
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        kind: "upload",
        filename: "package.json",
        content: '{"name":"B"}',
      });
    },
  );

  it.each(["clear", "mode"] as const)(
    "invalidates pending reads on %s and preserves pasted text",
    async (action) => {
      const onSubmit = vi
        .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
        .mockResolvedValue(undefined);
      render(<QuickAnalysisForm onSubmit={onSubmit} />);
      fireEvent.change(screen.getByLabelText("package.json content"), {
        target: { value: '{"name":"paste"}' },
      });
      fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
      const a = deferredFile();
      selectFile(a.file);
      if (action === "clear") selectFile();
      else fireEvent.click(screen.getByRole("radio", { name: /Paste manifest/ }));
      await act(async () => a.resolve('{"name":"obsolete"}'));
      if (action === "mode")
        fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
      fireEvent.click(screen.getByRole("button", { name: "Run quick analysis" }));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("Choose a package.json");
      fireEvent.click(screen.getByRole("radio", { name: /Paste manifest/ }));
      expect(screen.getByLabelText("package.json content")).toHaveValue('{"name":"paste"}');
    },
  );

  it("reports current read failures and recovers on replacement", async () => {
    render(
      <QuickAnalysisForm
        onSubmit={vi
          .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
          .mockResolvedValue(undefined)}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    const a = deferredFile();
    selectFile(a.file);
    await act(async () => a.reject(new Error("current")));
    expect(screen.getByRole("alert")).toHaveTextContent("could not read");
    const b = deferredFile();
    selectFile(b.file);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => b.resolve("{}"));
    expect(screen.getByRole("button", { name: "Run quick analysis" })).toBeEnabled();
  });

  it("discards pending reads when the form unmounts", async () => {
    const onSubmit = vi
      .fn<(input: QuickManifestAnalysisInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    const view = render(<QuickAnalysisForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    const a = deferredFile();
    selectFile(a.file);
    view.unmount();
    await act(async () => a.reject(new Error("unmounted")));
    render(<QuickAnalysisForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("radio", { name: /Choose local file/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
