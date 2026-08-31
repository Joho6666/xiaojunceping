import { ProjectReport, RequirementProfile } from "../../types";

export function critiqueReport(profile: RequirementProfile, report: ProjectReport): string[] {
  const notes: string[] = [];
  if (profile.dataSensitivity === "高" && report.techStack.some((item) => /supabase|firebase|saas/i.test(item.name))) {
    notes.push("Security Reviewer：高敏感数据场景不建议直接采用默认 SaaS 配置，需确认隔离、合规和退出方案。");
  }
  if (report.githubProjects.some((item) => item.licenseUse === "不建议商业复用")) {
    notes.push("License Reviewer：候选仓库含 copyleft 许可证，不能当作默认可商业二开基础。");
  }
  if (report.models.some((item) => item.roleKind !== "evaluator") === false) {
    notes.push("Model Router：当前缺少独立执行模型候选。");
  }
  if ((profile.domains || []).length > 1 && report.agents.length < 3) {
    notes.push("Architect：多领域项目的 Agent 分工可能过粗，建议按领域补角色。");
  }
  if (!notes.length) notes.push("Independent Critic：未发现必须否决的硬冲突，但仍需核验未知项。");
  return notes;
}
