import { ProjectReadiness, ProjectReport, RequirementProfile } from "../../types";
import { classifyUnknowns } from "./unknowns";

const PRODUCTION_CHECKS: Array<{ id: string; pattern: RegExp }> = [
  { id: "security", pattern: /security|安全|密钥|权限/ },
  { id: "observability", pattern: /observability|监控|日志|metric|trace/ },
  { id: "deployment", pattern: /deploy|部署|发布/ },
  { id: "backup", pattern: /backup|备份/ },
  { id: "lifecycle", pattern: /lifecycle|生命周期/ },
  { id: "rate-limit", pattern: /rate.?limit|限流/ },
  { id: "recovery", pattern: /recover|恢复|失败重试/ },
  { id: "compliance", pattern: /compliance|合规/ },
  { id: "performance", pattern: /performance|性能/ },
];

function haystack(report: ProjectReport) {
  return [
    ...report.architecture,
    ...(report.architectureDetail?.components || []),
    ...(report.architectureDetail?.securityBoundaries || []),
    ...(report.techStack || []).map((item) => item.name),
    ...(report.risks || []).map((item) => `${item.title} ${item.advice}`),
    ...(report.tools || []).map((item) => `${item.name} ${item.purpose}`),
  ].join(" ");
}

export function assessReadiness(profile: RequirementProfile, report: ProjectReport): ProjectReadiness {
  if (report.clarificationQuestions?.length || report.projectSummary.status === "needs_clarification") return "needs_clarification";
  const unknowns = report.unknownItems?.length ? report.unknownItems : classifyUnknowns(profile, report);
  const blockingDev = unknowns.filter((item) => item.severity === "blocking" && item.requiredFor === "development");
  const blockingProto = unknowns.filter((item) => item.severity === "blocking" && item.requiredFor === "prototype");
  if ((report.blockingIssues || []).length && (blockingDev.length || blockingProto.length)) return "blocked";
  const completeness = profile.completeness?.score || 0;
  if (completeness < 0.35) return "not_ready";
  const hasAcceptance = (report.projectSummary.acceptanceCriteria || []).length > 0 || (profile.requiredFeatures || []).length > 0;
  const architectureOk = (report.architectureDetail?.components.length || report.architecture.length) > 0;
  const taskCoverage = report.executionPlan?.taskCoverage ?? report.executionPlan?.coverage ?? 0;
  const executorCoverage = report.executionPlan?.executorCoverage ?? 0;
  if (blockingProto.length) return "research_ready";
  const githubOk = !profile.needsGithub || (report.githubProjects || []).some((item) => /^https:\/\/github\.com\//i.test(item.url));
  const text = haystack(report);
  const productionHits = PRODUCTION_CHECKS.filter((item) => item.pattern.test(text)).length;
  const productionUnknowns = unknowns.filter((item) => item.requiredFor === "production" && item.severity === "blocking");
  if (completeness >= 0.45 && hasAcceptance && architectureOk && !blockingProto.length) {
    if (completeness >= 0.7 && taskCoverage >= 1 && executorCoverage >= 1 && githubOk && !blockingDev.length) {
      if (productionHits >= 5 && !productionUnknowns.length) return "production_ready";
      return "development_ready";
    }
    return "prototype_ready";
  }
  return "research_ready";
}
