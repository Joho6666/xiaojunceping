import { KnowledgeItem, KnowledgeMatch, RequirementProfile } from "../types";

export function knowledgeHardFilterReason(profile: RequirementProfile, item: KnowledgeItem): string | null {
  if (item.status !== "active") return "条目已失效或过期";
  if (item.publication !== "published") return "条目尚未发布";
  if (profile.dataSensitivity === "高" && /cloud|仅云端/i.test(`${item.access} ${item.summary}`)) {
    return "高敏感数据不优先推荐仅云端方案";
  }
  if (profile.platforms.includes("Self-host") && item.platforms.length && !item.platforms.some((platform) => /self|windows|linux|mac/i.test(platform))) {
    return "部署平台不匹配";
  }
  return null;
}

export function applyKnowledgeRules(profile: RequirementProfile, matches: KnowledgeMatch[]) {
  return matches.filter((match) => {
    const reason = knowledgeHardFilterReason(profile, match.item);
    if (reason) {
      match.ruleNotes.push(reason);
      return false;
    }
    match.ruleNotes.push(match.matchedBy.length ? `命中：${match.matchedBy.slice(0, 4).join("、")}` : "未命中明确标签");
    return true;
  }).sort((a, b) => b.score - a.score);
}
