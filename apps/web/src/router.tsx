import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { StackMark } from "./features/analyze/stack-mark.js";
import { QuickAnalysisPage } from "./features/quick-analysis/quick-analysis-page.js";
import { RepositoryAnalysisHome } from "./features/repository-analysis/repository-analysis-home.js";
import { RepositoryAnalysisPage } from "./features/repository-analysis/repository-analysis-page.js";

function RootLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-card focus:p-4 focus:text-primary"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-md text-xl font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
          >
            <StackMark />
            StackLens
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:block">
            Evidence-backed stack analysis
          </span>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: RepositoryAnalysisHome,
});

function AnalysisRouteComponent() {
  const { analysisId } = analysisRoute.useParams();

  return <RepositoryAnalysisPage analysisId={analysisId} />;
}

const quickAnalysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/quick",
  component: QuickAnalysisPage,
});

const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analyses/$analysisId",
  component: AnalysisRouteComponent,
});

const routeTree = rootRoute.addChildren([indexRoute, quickAnalysisRoute, analysisRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
