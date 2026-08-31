import { ProjectReport, RequirementProfile } from "../../types";

export function critiqueReport(profile: RequirementProfile, report: ProjectReport): string[] {
  const { blockingIssues, warnings } = structuredCritique(profile, report);
  return [...blockingIssues, ...warnings];
}

export function structuredCritique(profile: RequirementProfile, report: ProjectReport) {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  if (profile.dataSensitivity === "高" && report.techStack.some((item) => /supabase|firebase|saas/i.test(item.name))) {
    blockingIssues.push("高敏感数据场景不建议直接采用默认 SaaS 配置");
  }
  if (report.githubProjects.some((item) => item.licenseUse === "不建议商业复用") && report.strategy.type === "基于开源项目二次开发") {
    blockingIssues.push("许可证冲突：copyleft 仓库不能作为默认可商业二开基础");
  }
  if (report.models.some((item) => item.roleKind === "execution") === false) {
    warnings.push("缺少独立执行模型候选");
  }
  if ((profile.requiredFeatures || []).length && (report.executionPlan?.coverage || 0) < 1) {
    blockingIssues.push("存在没有施工任务的 Required Feature，不能 Development Ready");
  }
  if (!(profile.platforms || []).filter((item) => item !== "unknown").length) {
    warnings.push("平台仍为 unknown，架构可能过度或不足");
  }
  if (!blockingIssues.length && !warnings.length) {
    warnings.push("未发现必须否决的硬冲突，但仍需核验未知项");
  }
  return { blockingIssues, warnings, disagreements: [] as string[], recommendedChanges: blockingIssues.map((item) => `先解决：${item}`) };
}
