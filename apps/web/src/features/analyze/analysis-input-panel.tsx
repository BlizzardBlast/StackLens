import { useId, type ReactNode } from "react";

import { AnalysisModeNav, type AnalysisInputMode } from "./analysis-mode-nav.js";

export interface AnalysisInputPanelProps {
  readonly current: AnalysisInputMode;
  readonly formTitle: string;
  readonly formDescription: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function AnalysisInputPanel({
  current,
  formTitle,
  formDescription,
  className,
  children,
}: Readonly<AnalysisInputPanelProps>) {
  const formTitleId = useId();

  return (
    <section
      className={["analysis-panel", className].filter(Boolean).join(" ")}
      aria-labelledby={formTitleId}
    >
      <div className="analysis-panel-heading">
        <div>
          <p className="analysis-eyebrow">Start an analysis</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Choose your evidence source
          </h2>
        </div>
        <p className="analysis-panel-disclosure">
          Static inspection only. Project code never runs.
        </p>
      </div>
      <div className="analysis-mode-region bg-muted/45">
        <AnalysisModeNav current={current} />
      </div>
      <div className="grid gap-6 p-5 sm:p-7">
        <div className="grid gap-2">
          <h3 id={formTitleId} className="text-xl font-semibold tracking-tight">
            {formTitle}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">{formDescription}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
