import { Link, Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { QuickAnalysisPage } from "./features/quick-analysis/quick-analysis-page.js";
import { RepositoryAnalysisHome } from "./features/repository-analysis/repository-analysis-home.js";
import { RepositoryAnalysisPage } from "./features/repository-analysis/repository-analysis-page.js";

function RootLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="rounded-md text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
          >
            StackLens
          </Link>
          <span className="text-sm text-muted-foreground">Evidence-backed stack analysis</span>
        </div>
      </header>
      <main>
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
