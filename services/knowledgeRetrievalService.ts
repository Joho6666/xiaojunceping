import { KnowledgeItem, KnowledgeKind, KnowledgeMatch, RequirementProfile } from "../types";
import { listKnowledgeItems } from "./knowledgeBaseService";

function words(value: string[]) { return value.join(" ").toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter((x) => x.length > 1); }

export function retrieveKnowledge(profile: RequirementProfile, kind?: KnowledgeKind): KnowledgeMatch[] {
  const required = words([...profile.tags, ...profile.capabilities, ...profile.stack, ...profile.domain]);
  return listKnowledgeItems(kind).map((item) => {
    const haystack = words([item.name, item.summary, ...item.tags, ...item.capabilities, ...item.stack]);
    const matchedBy = required.filter((term) => haystack.some((word) => word.includes(term) || term.includes(word)));
    const sourceWeight = item.confidence === "高" ? 15 : item.confidence === "中" ? 8 : 2;
    return { item, score: Math.min(99, 35 + matchedBy.length * 8 + sourceWeight), matchedBy, ruleNotes: [], evidence: "knowledge-base" as const };
  }).filter((match) => match.matchedBy.length > 0).sort((a, b) => b.score - a.score).slice(0, 30);
}
