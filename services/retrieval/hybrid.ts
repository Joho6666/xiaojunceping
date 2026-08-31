import { KnowledgeItem, KnowledgeMatch, RequirementProfile, RetrievalMode } from "../../types";
import { listKnowledgeItems } from "../knowledgeBaseService";
import { BM25Index } from "./bm25Index";
import { cosineSimilarity, createEmbeddingProvider } from "./embedding";
import { ruleRerank } from "./reranker";
import { RETRIEVAL_WEIGHTS } from "./weights";

function documentText(item: KnowledgeItem) {
  return [item.name, item.summary, ...item.tags, ...item.capabilities, ...item.stack].join(" ");
}

function metadataScore(item: KnowledgeItem, profile: RequirementProfile) {
  let score = 0;
  if (item.confidence === "高") score += 0.6;
  else if (item.confidence === "中") score += 0.3;
  if (profile.platforms.includes("Self-host") && item.platforms.some((platform) => /self|windows|linux|mac/i.test(platform))) score += 0.4;
  return Math.min(1, score);
}

function sourceScore(item: KnowledgeItem) {
  if (item.sourceType === "official") return 1;
  if (item.sourceType === "github" || item.sourceType === "registry") return 0.7;
  if (item.sourceType === "npm") return 0.55;
  return 0.3;
}

export function retrieveKnowledgeHybrid(profile: RequirementProfile): { matches: KnowledgeMatch[]; retrievalMode: RetrievalMode } {
  const items = listKnowledgeItems();
  const query = [...profile.tags, ...profile.capabilities, ...profile.stack, ...profile.domain, ...(profile.requiredFeatures || []), ...(profile.goals || [])].join(" ");
  const index = new BM25Index(items.map((item) => ({ id: item.id, text: documentText(item) })));
  const lexical = index.rank(query, 30);
  const lexicalMax = Math.max(...lexical.map((item) => item.score), 1);
  const byId = new Map(items.map((item) => [item.id, item]));
  const retrievalMode: RetrievalMode = "lexical";
  const mergedIds = new Set(lexical.map((item) => item.id));
  const matches: KnowledgeMatch[] = lexical.map((row) => {
    const item = byId.get(row.id)!;
    const lexicalNorm = row.score / lexicalMax;
    const meta = metadataScore(item, profile);
    const source = sourceScore(item);
    const score = retrievalMode === "lexical"
      ? lexicalNorm * 0.75 + meta * RETRIEVAL_WEIGHTS.metadata + source * RETRIEVAL_WEIGHTS.source
      : lexicalNorm * RETRIEVAL_WEIGHTS.lexical + meta * RETRIEVAL_WEIGHTS.metadata + source * RETRIEVAL_WEIGHTS.source;
    return {
      item,
      score: Math.min(99, score * 100),
      matchedBy: (profile.requiredFeatures || []).filter((feature) => documentText(item).toLowerCase().includes(feature.toLowerCase())),
      ruleNotes: [],
      evidence: "knowledge-base" as const,
    };
  });
  const ranked = ruleRerank(matches, 15);
  ranked.forEach((match) => {
    mergedIds.add(match.item.id);
  });
  return { matches: ranked, retrievalMode };
}

export async function retrieveKnowledgeHybridAsync(profile: RequirementProfile): Promise<{ matches: KnowledgeMatch[]; retrievalMode: RetrievalMode }> {
  const base = retrieveKnowledgeHybrid(profile);
  const embedding = createEmbeddingProvider();
  if (!embedding.available()) return { ...base, retrievalMode: "lexical" };
  const items = listKnowledgeItems();
  const query = [...profile.tags, ...profile.capabilities, ...profile.stack, ...profile.domain, ...(profile.requiredFeatures || [])].join(" ");
  const candidates = items.slice(0, 40);
  try {
    const vectors = await embedding.embed([query, ...candidates.map(documentText)]);
    if (vectors.length < 2) return { ...base, retrievalMode: "lexical" };
    const [queryVec, ...docVecs] = vectors;
    const semantic = candidates.map((item, index) => ({ item, score: cosineSimilarity(queryVec, docVecs[index] || []) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    const byId = new Map(base.matches.map((match) => [match.item.id, match]));
    for (const row of semantic) {
      const current = byId.get(row.item.id);
      const semanticPart = row.score * RETRIEVAL_WEIGHTS.semantic * 100;
      if (current) current.score = Math.min(99, current.score * (RETRIEVAL_WEIGHTS.lexical + RETRIEVAL_WEIGHTS.metadata + RETRIEVAL_WEIGHTS.source) / 0.6 + semanticPart);
      else byId.set(row.item.id, { item: row.item, score: Math.min(99, semanticPart), matchedBy: [], ruleNotes: ["semantic"], evidence: "knowledge-base" });
    }
    return { matches: ruleRerank(Array.from(byId.values()), 15), retrievalMode: "hybrid" };
  } catch {
    return { ...base, retrievalMode: "lexical" };
  }
}
