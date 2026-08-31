import { KnowledgeKind, KnowledgeMatch, RequirementProfile, RetrievalMode } from "../types";
import { retrieveKnowledgeHybrid, retrieveKnowledgeHybridAsync } from "./retrieval/hybrid";

export function retrieveKnowledge(profile: RequirementProfile, kind?: KnowledgeKind): KnowledgeMatch[] {
  const { matches } = retrieveKnowledgeHybrid(profile);
  return kind ? matches.filter((match) => match.item.kind === kind) : matches;
}

export async function retrieveKnowledgeAsync(profile: RequirementProfile, kind?: KnowledgeKind): Promise<{ matches: KnowledgeMatch[]; retrievalMode: RetrievalMode }> {
  const retrieved = await retrieveKnowledgeHybridAsync(profile);
  return {
    matches: kind ? retrieved.matches.filter((match) => match.item.kind === kind) : retrieved.matches,
    retrievalMode: retrieved.retrievalMode,
  };
}
