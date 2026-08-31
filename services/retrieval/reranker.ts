import { KnowledgeMatch } from "../../types";

export function ruleRerank(matches: KnowledgeMatch[], limit = 15): KnowledgeMatch[] {
  return [...matches]
    .sort((a, b) => b.score - a.score || (b.item.confidence === "高" ? 1 : 0) - (a.item.confidence === "高" ? 1 : 0))
    .slice(0, limit);
}

export async function llmRerank(matches: KnowledgeMatch[], _query: string, limit = 15): Promise<KnowledgeMatch[]> {
  return ruleRerank(matches, limit);
}
