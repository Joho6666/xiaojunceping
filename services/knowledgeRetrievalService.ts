import { KnowledgeKind, KnowledgeMatch, RequirementProfile } from "../types";
import { retrieveKnowledgeHybrid } from "./retrieval/hybrid";

export function retrieveKnowledge(profile: RequirementProfile, kind?: KnowledgeKind): KnowledgeMatch[] {
  const { matches } = retrieveKnowledgeHybrid(profile);
  return kind ? matches.filter((match) => match.item.kind === kind) : matches;
}
