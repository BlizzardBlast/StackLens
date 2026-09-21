import { useState, type FormEvent } from "react";

import { Button } from "@stacklens/ui/components/button";

export interface RepositoryAnalysisFormProps {
  readonly onSubmit: (repositoryUrl: string) => Promise<void>;
  readonly isPending?: boolean;
  readonly serverError?: string;
}

function obviousUrlError(value: string): string | undefined {
  if (value.length === 0) {
    return "Enter a public GitHub repository URL.";
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return "Use an HTTPS repository URL.";
    }
  } catch {
    return "Enter a valid HTTPS URL.";
  }

  return undefined;
}

export function RepositoryAnalysisForm({
  onSubmit,
  isPending = false,
  serverError,
}: Readonly<RepositoryAnalysisFormProps>) {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [clientError, setClientError] = useState<string>();

  async function submit(): Promise<void> {
    const normalizedValue = repositoryUrl.trim();
    const validationError = obviousUrlError(normalizedValue);

    if (validationError !== undefined) {
      setClientError(validationError);
      return;
    }

    setClientError(undefined);
    await onSubmit(normalizedValue).catch(() => undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  const error = clientError ?? serverError;
  const errorId = error === undefined ? undefined : "repository-url-error";

  return (
    <form className="grid gap-5" onSubmit={handleSubmit} noValidate aria-busy={isPending}>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="repository-url" className="text-sm font-semibold">
            Public GitHub repository
          </label>
          <span className="text-xs text-muted-foreground">HTTPS URL</span>
        </div>
        <input
          id="repository-url"
          name="repositoryUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://github.com/owner/repository"
          value={repositoryUrl}
          onChange={(event) => {
            setRepositoryUrl(event.currentTarget.value);
            if (clientError !== undefined) {
              setClientError(undefined);
            }
          }}
          aria-invalid={error === undefined ? undefined : true}
          aria-describedby={errorId ?? "repository-url-help"}
          disabled={isPending}
          className="min-h-12 w-full rounded-lg border bg-background px-4 py-3 font-mono text-sm transition-[border-color,box-shadow,background-color] outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        />
        <p id="repository-url-help" className="text-xs leading-5 text-muted-foreground">
          Server validation remains authoritative. The repository must be publicly accessible.
        </p>
        {error === undefined ? null : (
          <p id="repository-url-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="grid gap-3">
        <Button type="submit" disabled={isPending} className="min-h-11 w-full sm:w-fit">
          {isPending ? (
            <>
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground motion-reduce:animate-none"
              />
              Starting analysis
            </>
          ) : (
            "Analyze repository"
          )}
        </Button>

        {isPending ? (
          <output
            aria-live="polite"
            className="flex items-start gap-3 rounded-lg border bg-muted/35 px-4 py-3"
          >
            <span
              aria-hidden="true"
              className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-semibold">Creating analysis</span>
              <span className="text-xs leading-5 text-muted-foreground">
                Preparing the durable analysis state before opening live progress.
              </span>
            </span>
          </output>
        ) : (
          <p className="text-xs text-muted-foreground">
            Static inspection only · Public repositories · No project code execution
          </p>
        )}
      </div>
    </form>
  );
}
