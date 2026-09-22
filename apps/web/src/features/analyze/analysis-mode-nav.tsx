import { Link } from "@tanstack/react-router";

export type AnalysisInputMode = "repository" | "manifest";

export interface AnalysisModeNavProps {
  readonly current: AnalysisInputMode;
}

const modes = [
  {
    id: "repository",
    to: "/",
    label: "GitHub repository",
    detail: "Full repository evidence",
  },
  {
    id: "manifest",
    to: "/quick",
    label: "package.json",
    detail: "Fast manifest-only pass",
  },
] as const;

export function AnalysisModeNav({ current }: Readonly<AnalysisModeNavProps>) {
  return (
    <nav
      aria-label="Analysis input mode"
      className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/30 p-2 sm:grid-cols-2"
    >
      {modes.map((mode) => {
        const active = mode.id === current;

        return (
          <Link
            key={mode.id}
            to={mode.to}
            aria-current={active ? "page" : undefined}
            className={[
              "grid min-h-16 gap-0.5 rounded-lg border px-4 py-3 outline-none transition-[background-color,border-color,box-shadow]",
              "focus-visible:ring-3 focus-visible:ring-ring/35",
              active
                ? "border-primary/35 bg-background shadow-sm"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground",
            ].join(" ")}
          >
            <span className="text-sm font-semibold">{mode.label}</span>
            <span className="text-xs">{mode.detail}</span>
          </Link>
        );
      })}
    </nav>
  );
}
