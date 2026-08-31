import { ProjectReport, VerificationStatus } from "../../types";
import { classifySourceUrl } from "../verification/sourceVerifier";

export function verifyReport(report: ProjectReport): ProjectReport {
  const unknownFields = [...(report.unknownFields || [])];
  const needsConfirmation = [...(report.needsConfirmation || [])];
  const blockingIssues = [...(report.blockingIssues || [])];
  const evidence = (report.evidence || []).map((item) => {
    const sourceClass = item.sourceClass || classifySourceUrl(item.url);
    const ok = Boolean(item.url && /^https?:\/\//i.test(item.url) && sourceClass !== "unknown");
    const verificationStatus: VerificationStatus = item.verificationStatus || (ok ? "partially_verified" : "unverified");
    if (item.verificationStatus === "verified" && !ok) blockingIssues.push(`标为 verified 但缺少可核验 URL：${item.title}`);
    return {
      ...item,
      sourceClass,
      verificationStatus,
      verifiedFields: item.verifiedFields || (ok ? ["url"] : []),
      unverifiedFields: item.unverifiedFields || (ok ? [] : ["url"]),
    };
  });
  const evidenceIds = new Set(evidence.map((item) => item.id));

  const github = (report.githubProjects || []).map((item) => {
    const urlOk = /^https:\/\/github\.com\//i.test(item.url);
    if (!urlOk) {
      unknownFields.push(`github:${item.name}:url`);
      return { ...item, advice: "URL 未核验，相关度证据不足", source: item.source || "snapshot" };
    }
    return item;
  });

  for (const model of report.models || []) {
    if (!model.modelId) unknownFields.push(`model:${model.name}:id`);
  }
  for (const stack of report.techStack || []) {
    if (stack.name.includes("待确认") || stack.name === "待确认技术栈") needsConfirmation.push(`tech:${stack.name}`);
  }
  if (!github.length && unknownFields.includes("github")) unknownFields.push("github:none");
  if (report.estimates.cost.display === "unknown") unknownFields.push("cost");
  if (report.estimates.time.range === "insufficient_evidence") unknownFields.push("time");

  const keyItems = [...(report.agents || []), ...(report.models || []), ...(report.githubProjects || []), ...(report.techStack || [])];
  const withEvidence = keyItems.filter((item) => "evidenceIds" in item && (item.evidenceIds || []).some((id) => evidenceIds.has(id)));
  const coverage = keyItems.length ? withEvidence.length / keyItems.length : 1;
  if (coverage < 0.9) needsConfirmation.push(`证据覆盖率 ${(coverage * 100).toFixed(0)}% < 90%`);

  return {
    ...report,
    githubProjects: github,
    evidence,
    unknownFields: Array.from(new Set(unknownFields)),
    needsConfirmation: Array.from(new Set(needsConfirmation)),
    blockingIssues: Array.from(new Set(blockingIssues)),
  };
}
