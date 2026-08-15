import { KnowledgeMatch, RequirementProfile } from "../types";

export function applyKnowledgeRules(profile: RequirementProfile, matches: KnowledgeMatch[]) {
  return matches.filter((match) => {
    const item = match.item;
    if (item.status !== "active" || item.publication !== "published") {
      match.ruleNotes.push(item.status !== "active" ? "条目已失效或过期" : "条目尚未发布");
      return false;
    }
    if (profile.dataSensitivity === "高" && /cloud|仅云端/i.test(`${item.access} ${item.summary}`)) { match.ruleNotes.push("高敏感数据不优先推荐仅云端方案"); return false; }
    if (profile.platforms.includes("Self-host") && item.platforms.length && !item.platforms.some((platform) => /self|windows|linux|mac/i.test(platform))) { match.ruleNotes.push("部署平台不匹配"); return false; }
    match.score = Math.min(99, match.score + (item.verifiedAt ? 5 : 0));
    match.ruleNotes.push(match.matchedBy.length ? `命中：${match.matchedBy.slice(0, 4).join("、")}` : "未命中明确标签");
    return true;
  }).sort((a, b) => b.score - a.score);
}
