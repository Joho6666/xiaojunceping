import { ProjectReport } from "../../types";

export function verifyReport(report: ProjectReport): ProjectReport {
  const unknownFields = [...(report.unknownFields || [])];
  const needsConfirmation = [...(report.needsConfirmation || [])];
  const evidence = report.evidence || [];
  const evidenceIds = new Set(evidence.map((item) => item.id));

  const github = (report.githubProjects || []).map((item) => {
    const urlOk = /^https:\/\/github\.com\//i.test(item.url);
    if (!urlOk) {
      unknownFields.push(`github:${item.name}:url`);
      return { ...item, similarity: 0, advice: "URL 未核验，相关度降为 0", source: item.source || "snapshot" };
    }
    return item;
  });

  for (const model of report.models || []) {
    if (!model.modelId) unknownFields.push(`model:${model.name}:id`);
    if (model.roleKind === "evaluator" && (report.models || []).length === 1) {
      needsConfirmation.push("执行模型与评估模型尚未分离出独立候选");
    }
  }

  for (const stack of report.techStack || []) {
    if (stack.name.includes("待确认") || stack.matchScore < 55) needsConfirmation.push(`tech:${stack.name}`);
  }

  if (!github.length) unknownFields.push("github:none");
  if (report.estimates.cost.display === "unknown") unknownFields.push("cost");
  if (report.estimates.time.range === "insufficient_evidence") unknownFields.push("time");

  const missingEvidence = [
    ...(report.agents || []),
    ...(report.models || []),
    ...(report.githubProjects || []),
    ...(report.techStack || []),
  ].filter((item) => "evidenceIds" in item && !(item.evidenceIds || []).some((id) => evidenceIds.has(id)));
  if (missingEvidence.length) needsConfirmation.push(`有 ${missingEvidence.length} 项推荐缺少可解析 Evidence`);

  return {
    ...report,
    githubProjects: github,
    unknownFields: Array.from(new Set(unknownFields)),
    needsConfirmation: Array.from(new Set(needsConfirmation)),
  };
}
