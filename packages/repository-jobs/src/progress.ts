import type { RepositoryAnalysisProgress } from "@stacklens/analysis-orchestration";
import type { AnalysisProgressStage } from "@stacklens/persistence";

export function durableStageForProgress(
  progress: RepositoryAnalysisProgress,
): AnalysisProgressStage | undefined {
  switch (progress.phase) {
    case "repository":
      return progress.status === "started" ? "resolving_repository" : "collecting_snapshot";
    case "manifest":
      return "collecting_snapshot";
    case "package_metadata":
    case "vulnerability_data":
      return "collecting_metadata";
    case "analysis":
      return progress.status === "completed" ? "scoring" : "running_rules";
  }
}
