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
    await onSubmit(normalizedValue);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submit();
  }

  const error = clientError ?? serverError;
  const errorId = error === undefined ? undefined : "repository-url-error";

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <label htmlFor="repository-url" className="text-sm font-semibold">
          Public GitHub repository
        </label>
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
          className="min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
        />
        <p id="repository-url-help" className="text-xs text-muted-foreground">
          StackLens performs static inspection only. Server validation is authoritative.
        </p>
        {error === undefined ? null : (
          <p id="repository-url-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Submitting…" : "Analyze repository"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Public repositories · No project code execution
        </span>
      </div>
    </form>
  );
}
