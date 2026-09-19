import { cn } from "cn";
import type { ReactNode } from "react";

import { Button } from "#components/button";
import {
  ConfidenceIndicator,
  FindingTypeBadge,
  SeverityBadge,
  type FindingClassification,
  type FindingConfidence,
  type FindingPriority,
} from "#domain/finding-badges";

export interface FindingCardProps {
  classification: FindingClassification;
  priority: FindingPriority;
  confidence?: FindingConfidence;
  subject?: string;
  title: string;
  description: ReactNode;
  category: string;
  ruleId: string;
  onViewEvidence?: () => void;
  className?: string;
}

export function FindingCard({
  classification,
  priority,
  confidence,
  subject,
  title,
  description,
  category,
  ruleId,
  onViewEvidence,
  className,
}: Readonly<FindingCardProps>) {
  return (
    <article className={cn("rounded-xl border bg-card p-5 text-card-foreground", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge priority={priority} />
        <FindingTypeBadge classification={classification} />
        {classification === "heuristic" && confidence ? (
          <ConfidenceIndicator confidence={confidence} />
        ) : null}
        {subject ? <code className="text-xs text-muted-foreground">{subject}</code> : null}
      </div>

      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{description}</div>

      <footer className="mt-4 flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {category} · Rule <code>{ruleId}</code>
        </span>
        {onViewEvidence ? (
          <Button variant="link" size="sm" onClick={onViewEvidence}>
            View evidence <span aria-hidden="true">→</span>
          </Button>
        ) : null}
      </footer>
    </article>
  );
}
