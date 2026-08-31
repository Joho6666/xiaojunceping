import { ProjectReport, RequirementProfile, UnknownItem } from "../../types";

export function classifyUnknowns(profile: RequirementProfile, report: ProjectReport): UnknownItem[] {
  const items: UnknownItem[] = [];
  const platforms = (profile.platforms || []).filter((item) => item !== "unknown");
  const haystack = `${profile.goals.join(" ")} ${(profile.requiredFeatures || []).join(" ")} ${(profile.stack || []).join(" ")}`;
  if (!platforms.length) {
    items.push({ field: "platform", reason: "目标平台未知", severity: "blocking", requiredFor: "development" });
  }
  if (!(profile.requiredFeatures || []).length) {
    items.push({ field: "features", reason: "核心功能未知", severity: "blocking", requiredFor: "prototype" });
  }
  const mentionsChip = /单片机|芯片型号|mcu|嵌入式温控/.test(haystack) || (/芯片/.test(haystack) && !/stm32|esp32|nrf|gd32/i.test(haystack));
  const chipKnown = (profile.stack || []).some((item) => /stm32|esp32|keil|platformio/i.test(item))
    || /stm32|esp32|nrf|gd32|keil|ds18b20/i.test(haystack);
  if (mentionsChip && !chipKnown) {
    items.push({ field: "chip", reason: "核心芯片/固件方案未确认", severity: "blocking", requiredFor: "development" });
  }
  if ((profile.requiredFeatures || []).includes("payment") && !(profile.integrations || []).some((item) => item.type === "payment")) {
    items.push({ field: "payment", reason: "支付方案未知", severity: "blocking", requiredFor: "development" });
  }
  if (/api|第三方|openai|stripe|支付/.test(haystack) && !(profile.integrations || []).length && !(profile.stack || []).length) {
    items.push({ field: "core-api", reason: "核心 API 是否存在未知", severity: "blocking", requiredFor: "development" });
  }
  if (/数据来源|数据集|用户数据|采集/.test(haystack) && profile.dataSensitivity === "未知" && !(profile.integrations || []).some((item) => item.type === "database")) {
    items.push({ field: "data-source", reason: "数据来源未知", severity: "blocking", requiredFor: "development" });
  }
  if (report.estimates.cost.display === "unknown") {
    items.push({ field: "hosting-cost", reason: "Hosting / API 成本未知", severity: "optional", requiredFor: "production" });
  }
  if (report.estimates.time.range === "insufficient_evidence") {
    items.push({ field: "timeline", reason: "工期证据不足", severity: "important", requiredFor: "development" });
  }
  if (!report.techStack.some((item) => /observability|log|metric|trace/i.test(item.name))) {
    items.push({ field: "analytics", reason: "可选 Analytics / 可观测性未确定", severity: "optional", requiredFor: "production" });
  }
  if (profile.needsGithub && !(report.githubProjects || []).some((item) => /^https:\/\/github\.com\//i.test(item.url))) {
    items.push({ field: "github", reason: "需要仓库参考但没有已核验 GitHub", severity: "blocking", requiredFor: "development" });
  }
  return items;
}
