import { KnowledgeItem, KnowledgeMatch, RequirementProfile, RetrievalMode, RetrievalScore } from "../../types";
import { listKnowledgeItems } from "../knowledgeBaseService";
import { knowledgeHardFilterReason } from "../knowledgeRuleEngine";
import { BM25Index } from "./bm25Index";
import { combineRetrievalScore, EMBEDDING_BATCH_SIZE, LEXICAL_CANDIDATE_K, normalizeWeights, RERANK_LIMIT, SEMANTIC_CANDIDATE_K } from "./weights";
import { createEmbeddingProvider, EmbeddingProvider } from "./embedding";
import { contentHash, getCachedEmbedding, setCachedEmbedding } from "./embeddingCache";
import { ruleRerank } from "./reranker";
import { tokenize } from "./tokenizer";
import { BruteForceVectorIndex, VectorIndex } from "./vectorIndex";

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

function minMax(values: number[]) {
  if (!values.length) return [];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return values.map(() => (max > 0 ? 1 : 0));
  return values.map((value) => (value - min) / (max - min));
}

function queryText(profile: RequirementProfile) {
  return [...profile.tags, ...profile.capabilities, ...profile.stack, ...profile.domain, ...(profile.requiredFeatures || []), ...(profile.goals || [])].join(" ");
}

function matchedTermsFor(item: KnowledgeItem, profile: RequirementProfile) {
  const queryTokens = tokenize(queryText(profile));
  const doc = documentText(item).toLowerCase();
  const fromQuery = queryTokens.filter((token) => token.length > 1 && doc.includes(token.toLowerCase()));
  const fromFeatures = (profile.requiredFeatures || []).filter((feature) => doc.includes(feature.toLowerCase()));
  return Array.from(new Set([...fromQuery, ...fromFeatures]));
}

function toMatch(
  item: KnowledgeItem,
  profile: RequirementProfile,
  lexical: number | null,
  semantic: number | null,
  weights: ReturnType<typeof normalizeWeights>,
): KnowledgeMatch {
  const meta = metadataScore(item, profile);
  const source = sourceScore(item);
  const combined = combineRetrievalScore({ lexical, semantic, metadata: meta, sourceQuality: source }, weights);
  const retrievalScore: RetrievalScore = {
    lexical,
    semantic,
    metadata: meta,
    sourceQuality: source,
    final: combined.final,
  };
  const matchedTerms = matchedTermsFor(item, profile);
  return {
    item,
    score: Math.min(99, combined.final * 100),
    matchedBy: matchedTerms,
    ruleNotes: [],
    evidence: "knowledge-base",
    retrievalScore,
    retrievalDebug: {
      lexical,
      semantic,
      metadata: meta,
      source,
      final: combined.final,
      matchedTerms,
    },
  };
}

export function rankKnowledgeItems(
  profile: RequirementProfile,
  items: KnowledgeItem[],
  options: { lexicalIds: string[]; lexicalRaw: Map<string, number>; semanticIds: string[]; semanticRaw: Map<string, number>; hybrid: boolean },
): KnowledgeMatch[] {
  const weights = options.hybrid
    ? normalizeWeights(["lexical", "semantic", "metadata", "source"])
    : normalizeWeights(["lexical", "metadata", "source"]);
  const lexicalNorm = new Map<string, number>();
  const semanticNorm = new Map<string, number>();
  const lexicalValues = Array.from(options.lexicalRaw.values());
  const semanticValues = Array.from(options.semanticRaw.values());
  const lexicalScaled = minMax(lexicalValues);
  const semanticScaled = minMax(semanticValues);
  Array.from(options.lexicalRaw.keys()).forEach((id, index) => lexicalNorm.set(id, lexicalScaled[index] || 0));
  Array.from(options.semanticRaw.keys()).forEach((id, index) => semanticNorm.set(id, semanticScaled[index] || 0));
  const unionIds = new Set<string>([...options.lexicalIds, ...options.semanticIds]);
  const byId = new Map(items.map((item) => [item.id, item]));
  const matches = Array.from(unionIds)
    .map((id) => byId.get(id))
    .filter((item): item is KnowledgeItem => Boolean(item))
    .filter((item) => !knowledgeHardFilterReason(profile, item))
    .map((item) =>
      toMatch(
        item,
        profile,
        options.lexicalRaw.has(item.id) ? lexicalNorm.get(item.id) ?? 0 : null,
        options.hybrid && options.semanticRaw.has(item.id) ? semanticNorm.get(item.id) ?? 0 : null,
        weights,
      ),
    );
  return ruleRerank(matches, RERANK_LIMIT);
}

function lexicalRetrieve(profile: RequirementProfile, items: KnowledgeItem[]) {
  const query = queryText(profile);
  const index = new BM25Index(items.map((item) => ({ id: item.id, text: documentText(item) })));
  const lexicalRows = index.rank(query, LEXICAL_CANDIDATE_K);
  return {
    query,
    lexicalRows,
    lexicalRaw: new Map(lexicalRows.map((row) => [row.id, row.score])),
  };
}

export function retrieveKnowledgeHybrid(profile: RequirementProfile, items = listKnowledgeItems()): { matches: KnowledgeMatch[]; retrievalMode: RetrievalMode } {
  const { lexicalRows, lexicalRaw } = lexicalRetrieve(profile, items);
  return {
    matches: rankKnowledgeItems(profile, items, {
      lexicalIds: lexicalRows.map((row) => row.id),
      lexicalRaw,
      semanticIds: [],
      semanticRaw: new Map(),
      hybrid: false,
    }),
    retrievalMode: "lexical",
  };
}

async function loadVectors(
  items: KnowledgeItem[],
  query: string,
  embedding: EmbeddingProvider,
  model: string,
): Promise<{ queryVector: number[] | null; index: VectorIndex }> {
  const queryHash = contentHash(query);
  let queryVector = getCachedEmbedding("query:" + queryHash, model, queryHash);
  const missing: KnowledgeItem[] = [];
  const index = new BruteForceVectorIndex();
  for (const item of items) {
    const text = documentText(item);
    const hash = contentHash(text);
    const vector = getCachedEmbedding(item.id, model, hash);
    if (vector) index.upsert(item.id, vector);
    else missing.push(item);
  }
  const texts: string[] = [];
  if (!queryVector) texts.push(query);
  texts.push(...missing.map(documentText));
  if (texts.length) {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
      vectors.push(...await embedding.embed(batch));
    }
    let offset = 0;
    if (!queryVector) {
      queryVector = vectors[offset] || null;
      if (queryVector) setCachedEmbedding("query:" + queryHash, model, queryHash, queryVector);
      offset += 1;
    }
    missing.forEach((item, indexOffset) => {
      const vector = vectors[offset + indexOffset];
      if (!vector) throw new Error("EMBEDDING_VECTOR_MISSING");
      index.upsert(item.id, vector);
      try {
        setCachedEmbedding(item.id, model, contentHash(documentText(item)), vector);
      } catch {
        /* in-memory index already has the vector; cache write must not silently drop hybrid */
      }
    });
  }
  return { queryVector, index };
}

export async function retrieveKnowledgeHybridAsync(
  profile: RequirementProfile,
  items = listKnowledgeItems(),
  embedding = createEmbeddingProvider(),
): Promise<{ matches: KnowledgeMatch[]; retrievalMode: RetrievalMode }> {
  const { lexicalRows, lexicalRaw } = lexicalRetrieve(profile, items);
  let semanticRaw = new Map<string, number>();
  let retrievalMode: RetrievalMode = "lexical";

  if (embedding.available() && items.length) {
    try {
      const model = process.env.EMBEDDING_MODEL || "embedding";
      const loaded = await loadVectors(items, queryText(profile), embedding, model);
      if (loaded.queryVector) {
        loaded.index.search(loaded.queryVector, SEMANTIC_CANDIDATE_K).forEach((row) => semanticRaw.set(row.id, row.score));
        if (semanticRaw.size) retrievalMode = "hybrid";
      }
    } catch {
      retrievalMode = "lexical";
      semanticRaw = new Map();
    }
  }

  return {
    matches: rankKnowledgeItems(profile, items, {
      lexicalIds: lexicalRows.map((row) => row.id),
      lexicalRaw,
      semanticIds: Array.from(semanticRaw.keys()),
      semanticRaw,
      hybrid: retrievalMode === "hybrid",
    }),
    retrievalMode,
  };
}
