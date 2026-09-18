import { Badge } from "#components/badge";
import { cn } from "#lib/utils";

export type FindingClassification = "fact" | "heuristic" | "recommendation";
export type FindingPriority = "critical" | "high" | "medium" | "low";
export type FindingConfidence = "high" | "medium" | "low";

const classificationLabel: Record<FindingClassification, string> = {
  fact: "Fact",
  heuristic: "Heuristic",
  recommendation: "Recommendation"
};

const classificationMark: Record<FindingClassification, string> = {
  fact: "●",
  heuristic: "◆",
  recommendation: "→"
};

export function FindingTypeBadge({ classification }: { classification: FindingClassification }) {
  return (
    <Badge variant={classification}>
      <span aria-hidden="true">{classificationMark[classification]}</span>
      {classificationLabel[classification]}
    </Badge>
  );
}

export function SeverityBadge({ priority }: { priority: FindingPriority }) {
  return <Badge variant={priority}>{priority[0].toUpperCase() + priority.slice(1)}</Badge>;
}

export function ConfidenceIndicator({ confidence }: { confidence: FindingConfidence }) {
  return (
    <Badge
      variant="neutral"
      className={cn(
        confidence === "high" && "text-confidence-high",
        confidence === "medium" && "text-confidence-medium",
        confidence === "low" && "text-confidence-low"
      )}
    >
      {confidence[0].toUpperCase() + confidence.slice(1)} confidence
    </Badge>
  );
}
