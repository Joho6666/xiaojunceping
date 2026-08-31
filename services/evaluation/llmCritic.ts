import { ProjectReport, RequirementProfile } from "../../types";
import { structuredCritique } from "./critic";

export async function runLlmCritic(profile: RequirementProfile, report: ProjectReport) {
  // Expert optional critic. Without a dedicated critic model this stays rule-based
  // and must not invent stars, licenses, model IDs, or prices.
  const rules = structuredCritique(profile, report);
  return {
    blockingIssues: rules.blockingIssues,
    warnings: rules.warnings,
    disagreements: rules.disagreements,
    suggestedChanges: rules.recommendedChanges,
    mode: "optional-rule-fallback" as const,
  };
}
