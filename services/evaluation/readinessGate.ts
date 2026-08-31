import { ProjectReadiness, ProjectReport, RequirementProfile } from "../../types";

export function assessReadiness(profile: RequirementProfile, report: ProjectReport): ProjectReadiness {
  const completeness = profile.completeness?.score || 0;
  const blocking = (report.blockingIssues || []).length;
  const unknowns = (report.unknownFields || []).length;
  const coverage = report.executionPlan?.coverage ?? 0;
  if (report.clarificationQuestions?.length || report.projectSummary.status === "needs_clarification") return "needs_clarification";
  if (blocking) return "blocked";
  if (completeness < 0.35) return "not_ready";
  if (completeness < 0.55 || unknowns > 3) return "research_ready";
  const hasArchitecture = (report.architecture || []).length > 0;
  const hasAcceptance = (report.projectSummary.acceptanceCriteria || []).length > 0;
  const githubOk = report.githubProjects.some((item) => /^https:\/\/github\.com\//i.test(item.url));
  if (hasArchitecture && hasAcceptance && githubOk && completeness >= 0.7 && unknowns === 0 && coverage >= 1) return "development_ready";
  if (hasArchitecture && hasAcceptance) return "prototype_ready";
  return "research_ready";
}
