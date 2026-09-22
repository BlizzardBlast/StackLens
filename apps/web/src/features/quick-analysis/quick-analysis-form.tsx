import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@stacklens/ui/components/button";

import type { QuickManifestAnalysisInput } from "./quick-analysis-api.js";

type InputMode = QuickManifestAnalysisInput["kind"];

interface SelectedManifest {
  readonly filename: string;
  readonly content: string;
  readonly size: number;
}

export interface QuickAnalysisFormProps {
  readonly onSubmit: (input: QuickManifestAnalysisInput) => Promise<void>;
  readonly isPending?: boolean;
  readonly serverError?: string;
  readonly onInputChange?: () => void;
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function QuickAnalysisForm({
  onSubmit,
  isPending = false,
  serverError,
  onInputChange,
}: Readonly<QuickAnalysisFormProps>) {
  const [mode, setMode] = useState<InputMode>("paste");
  const [pastedContent, setPastedContent] = useState("");
  const [selectedManifest, setSelectedManifest] = useState<SelectedManifest>();
  const [clientError, setClientError] = useState<string>();

  function clearErrors(): void {
    setClientError(undefined);
    onInputChange?.();
  }

  function selectMode(nextMode: InputMode): void {
    setMode(nextMode);
    clearErrors();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    clearErrors();

    if (file === undefined) {
      setSelectedManifest(undefined);
      return;
    }

    try {
      const content = await file.text();
      setSelectedManifest({
        filename: file.name,
        content,
        size: file.size,
      });
    } catch {
      setSelectedManifest(undefined);
      setClientError("StackLens could not read this file in your browser.");
    }
  }

  async function submit(): Promise<void> {
    if (mode === "paste") {
      if (pastedContent.trim().length === 0) {
        setClientError("Paste package.json content before running quick analysis.");
        return;
      }

      setClientError(undefined);
      await onSubmit({ kind: "paste", content: pastedContent }).catch(() => undefined);
      return;
    }

    if (selectedManifest === undefined) {
      setClientError("Choose a package.json file before running quick analysis.");
      return;
    }

    setClientError(undefined);
    await onSubmit({
      kind: "upload",
      filename: selectedManifest.filename,
      content: selectedManifest.content,
    }).catch(() => undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  const error = clientError ?? serverError;
  const errorId = error === undefined ? undefined : "quick-analysis-error";

  return (
    <form className="grid gap-6" onSubmit={handleSubmit} noValidate aria-busy={isPending}>
      <fieldset className="grid gap-3" disabled={isPending}>
        <legend className="text-sm font-semibold">Choose your input</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="group cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name="quick-analysis-mode"
              value="paste"
              checked={mode === "paste"}
              onChange={() => selectMode("paste")}
            />
            <span className="grid min-h-24 gap-2 rounded-xl border bg-background p-4 transition-[background-color,border-color,box-shadow] group-hover:border-primary/25 peer-checked:border-primary/45 peer-checked:bg-primary/5 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/35">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Paste manifest</span>
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full border border-primary/35 bg-primary/10 peer-checked:bg-primary"
                />
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                Best when package.json is already open in your editor.
              </span>
            </span>
          </label>

          <label className="group cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name="quick-analysis-mode"
              value="upload"
              checked={mode === "upload"}
              onChange={() => selectMode("upload")}
            />
            <span className="grid min-h-24 gap-2 rounded-xl border bg-background p-4 transition-[background-color,border-color,box-shadow] group-hover:border-primary/25 peer-checked:border-primary/45 peer-checked:bg-primary/5 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/35">
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Choose local file</span>
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full border border-primary/35 bg-primary/10 peer-checked:bg-primary"
                />
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                Read package.json locally, then send only its text to StackLens.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {mode === "paste" ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="manifest-content" className="text-sm font-semibold">
              package.json content
            </label>
            <span className="text-xs text-muted-foreground">JSON text</span>
          </div>
          <textarea
            id="manifest-content"
            name="manifestContent"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={'{\n  "name": "my-project",\n  "dependencies": {\n    "react": "^19.0.0"\n  }\n}'}
            value={pastedContent}
            onChange={(event) => {
              setPastedContent(event.currentTarget.value);
              clearErrors();
            }}
            aria-invalid={error === undefined ? undefined : true}
            aria-describedby={errorId ?? "manifest-content-help"}
            disabled={isPending}
            className="min-h-72 w-full resize-y rounded-xl border bg-background px-4 py-4 font-mono text-sm leading-6 transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
          />
          <p id="manifest-content-help" className="text-xs leading-5 text-muted-foreground">
            Server validation is authoritative. StackLens does not execute scripts or install
            dependencies from this manifest.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          <label htmlFor="manifest-file" className="text-sm font-semibold">
            Local package.json
          </label>
          <div className="grid gap-4 rounded-xl border border-dashed bg-muted/20 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid gap-1">
              <p className="text-sm font-semibold">
                {selectedManifest?.filename ?? "Select a manifest from this device"}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {selectedManifest === undefined
                  ? "The browser reads the file locally. StackLens sends the filename and text through the existing JSON API."
                  : `${fileSizeLabel(selectedManifest.size)} ready for analysis`}
              </p>
            </div>
            <input
              id="manifest-file"
              name="manifestFile"
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                void handleFileChange(event);
              }}
              aria-invalid={error === undefined ? undefined : true}
              aria-describedby={errorId ?? "manifest-file-help"}
              disabled={isPending}
              className="block w-full max-w-64 text-sm text-muted-foreground file:mr-3 file:min-h-10 file:rounded-md file:border file:bg-background file:px-3 file:font-semibold file:text-foreground file:transition-colors hover:file:bg-accent focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <p id="manifest-file-help" className="text-xs leading-5 text-muted-foreground">
            The API accepts only an uploaded file named package.json; that filename rule remains
            authoritative on the server.
          </p>
        </div>
      )}

      {error === undefined ? null : (
        <p
          id="quick-analysis-error"
          role="alert"
          className="rounded-lg border border-destructive/35 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid gap-3">
        <Button type="submit" disabled={isPending} size="lg" className="w-full sm:w-fit">
          {isPending ? (
            <>
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground motion-reduce:animate-none"
              />
              Analyzing manifest
            </>
          ) : (
            "Run quick analysis"
          )}
        </Button>

        {isPending ? (
          <output
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border bg-primary/5 px-4 py-3"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">Analyzing package.json</span>
              <span className="text-xs leading-5 text-muted-foreground">
                This synchronous request validates the manifest and assembles an evidence-backed
                report. No background job or polling is created.
              </span>
            </span>
          </output>
        ) : (
          <p className="text-xs text-muted-foreground">
            Anonymous · Synchronous · No repository access · No project code execution
          </p>
        )}
      </div>
    </form>
  );
}
