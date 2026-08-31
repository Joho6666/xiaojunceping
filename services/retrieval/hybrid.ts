import { KnowledgeItem, KnowledgeMatch, RequirementProfile, RetrievalMode } from "../../types";
import { listKnowledgeItems } from "../knowledgeBaseService";
import { bm25Score, tokenize } from "./lexical";
import { createEmbeddingProvider } from "./embedding";

export function retrieveKnowledgeHybrid(profile: RequirementProfile): { matches: KnowledgeMatch[]; retrievalMode: RetrievalMode } {
  const items = listKnowledgeItems();
  const queryTokens = tokenize([
    ...profile.tags,
    ...profile.capabilities,
    ...profile.stack,
    ...profile.domain,
    ...(profile.requiredFeatures || []),
    ...(profile.goals || []),
  ].join(" "));
  const embedding = createEmbeddingProvider();
  const retrievalMode: RetrievalMode = embedding.available() ? "hybrid" : "lexical";
  const matches = items
    .map((item: KnowledgeItem) => {
      const documentTokens = tokenize([item.name, item.summary, ...item.tags, ...item.capabilities, ...item.stack].join(" "));
      const matchedBy = queryTokens.filter((token) => documentTokens.some((word) => word.includes(token) || token.includes(word)));
      const lexical = bm25Score(queryTokens, documentTokens);
      const metadataBoost =
        (item.confidence === "高" ? 8 : item.confidence === "中" ? 4 : 0) +
        (profile.platforms.includes("Self-host") && item.platforms.some((platform) => /self|windows|linux|mac/i.test(platform)) ? 4 : 0);
      return {
        item,
        score: Math.min(99, lexical + metadataBoost),
        matchedBy,
        ruleNotes: [],
        evidence: "knowledge-base" as const,
      };
    })
    .filter((match) => match.matchedBy.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);
  return { matches, retrievalMode };
}
