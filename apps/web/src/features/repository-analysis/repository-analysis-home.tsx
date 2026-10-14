import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { AnalysisInputPanel } from "../analyze/analysis-input-panel.js";
import { EvidencePath } from "../analyze/evidence-path.js";
import {
  githubConnectionClient,
  GitHubConnectionApiError,
} from "../github-connection/github-connection-api.js";
import {
  GitHubConnectionControl,
  useGitHubSession,
} from "../github-connection/github-connection.js";
import { RepositoryAnalysisApiError, repositoryAnalysisClient } from "./repository-analysis-api.js";
import { RepositoryAnalysisForm } from "./repository-analysis-form.js";

function errorMessage(error: unknown): string | undefined {
  if (error instanceof GitHubConnectionApiError) return error.message;
  if (error instanceof RepositoryAnalysisApiError) return error.message;
  if (error instanceof Error) return "StackLens could not submit this repository right now.";
  return undefined;
}

const capabilities = [
  {
    title: "Your code stays code",
    detail: "Static inspection without installing dependencies or running your project.",
  },
  {
    title: "Every finding has a source",
    detail: "Follow findings back to the project evidence, provider, and rule behind them.",
  },
  {
    title: "Uncertainty stays visible",
    detail: "Missing evidence is a stated limitation. It never becomes a clean bill of health.",
  },
] as const;

export function RepositoryAnalysisHome() {
  const navigate = useNavigate();
  const { session } = useGitHubSession();
  const [useConnection, setUseConnection] = useState(false);
  const connected = useConnection;
  const [connectionFailed] = useState(
    () => new URLSearchParams(window.location.search).get("github") === "error",
  );
  const mutation = useMutation({
    mutationFn: (repositoryUrl: string) => {
      if (useConnection) {
        if (session?.csrfToken === undefined) throw new GitHubConnectionApiError();
        return githubConnectionClient.submit(repositoryUrl, session.csrfToken);
      }
      return repositoryAnalysisClient.submitRepository(repositoryUrl);
    },
  });

  async function handleSubmit(repositoryUrl: string): Promise<void> {
    const { analysisId } = await mutation.mutateAsync(repositoryUrl);
    await navigate({ to: "/analyses/$analysisId", params: { analysisId } });
  }

  const mutationError = errorMessage(mutation.error);

  return (
    <div className="analysis-workspace mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:gap-12 lg:py-16">
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-16">
        <section className="analysis-intro">
          <p className="analysis-eyebrow">For JavaScript &amp; TypeScript projects</p>
          <h1 className="analysis-title">See your stack clearly.</h1>
          <p className="max-w-lg text-lg leading-7 text-muted-foreground">
            Understand your dependencies, spot risks, and plan your next move—with findings you can
            trace back to the evidence.
          </p>
        </section>

        <AnalysisInputPanel
          current="repository"
          formTitle={connected ? "Inspect a connected repository" : "Inspect a public repository"}
          formDescription="Start with a GitHub URL. Get a report on supported dependencies, configuration, and source evidence at a fixed revision."
          className="lg:col-start-2 lg:row-span-2"
        >
          {connectionFailed ? (
            <p role="alert" className="text-sm text-destructive">
              GitHub connection was not completed. Start the connection again when you are ready.
            </p>
          ) : null}
          {connected && session?.user === undefined ? (
            <p role="alert" className="text-sm text-destructive">
              Your GitHub session ended. Reconnect, or uncheck the connection to analyze a public
              repository.
            </p>
          ) : null}
          {session?.user === undefined && !connected ? null : (
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={useConnection}
                disabled={mutation.isPending}
                onChange={(event) => {
                  setUseConnection(event.currentTarget.checked);
                  mutation.reset();
                }}
                className="mt-1 size-4 accent-primary"
              />
              Use my GitHub connection for this analysis
            </label>
          )}
          <RepositoryAnalysisForm
            key={connected ? "connected" : "anonymous"}
            connected={connected}
            onSubmit={handleSubmit}
            isPending={mutation.isPending}
            {...(mutationError === undefined ? {} : { serverError: mutationError })}
          />
          <p className="border-t pt-4 text-sm text-muted-foreground">
            {connected
              ? "Only your account can open this analysis. Reconnect when your session expires."
              : "No account required for public repositories."}
          </p>
          <GitHubConnectionControl />
        </AnalysisInputPanel>

        <div className="lg:col-start-1 lg:row-start-2">
          <EvidencePath />
        </div>
      </div>

      <section
        className="analysis-principles grid gap-6 border-t pt-7 sm:grid-cols-3 sm:gap-8"
        aria-label="Analysis principles"
      >
        {capabilities.map((capability) => (
          <article key={capability.title} className="analysis-principle grid content-start gap-2">
            <h2 className="text-base font-semibold">{capability.title}</h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{capability.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
