import type {
  ConfidenceLevel,
  FindingClassification,
  PriorityLevel
} from "@stacklens/contracts/finding";
import { cn } from "cn";

import { Badge } from "#components/badge";

const classificationLabel: Record<FindingClassification, string> = {
  fact: "Fact",
  heuristic: "Heuristic"
};

const classificationMark: Record<FindingClassification, string> = {
  fact: "●",
  heuristic: "◆"
};

export function FindingTypeBadge({
  classification
}: Readonly<{ classification: FindingClassification }>) {
  return (
    <Badge variant={classification}>
      <span aria-hidden="true">{classificationMark[classification]}</span>
      {classificationLabel[classification]}
    </Badge>
  );
}

export function SeverityBadge({ priority }: Readonly<{ priority: PriorityLevel }>) {
  return <Badge variant={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Badge>;
}

export function ConfidenceIndicator({ confidence }: Readonly<{ confidence: ConfidenceLevel }>) {
  return (
    <Badge
      variant="neutral"
      className={cn(
        confidence === "high" && "text-confidence-high",
        confidence === "medium" && "text-confidence-medium",
        confidence === "low" && "text-confidence-low"
      )}
    >
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
    </Badge>
  );
}
