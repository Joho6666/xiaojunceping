export type RetrievalDimension = "lexical" | "semantic" | "metadata" | "source";

export const RETRIEVAL_WEIGHTS: Record<RetrievalDimension, number> = {
  lexical: 0.35,
  semantic: 0.4,
  metadata: 0.15,
  source: 0.1,
};

export const LEXICAL_CANDIDATE_K = 40;
export const SEMANTIC_CANDIDATE_K = 40;
export const RERANK_LIMIT = 15;
export const EMBEDDING_BATCH_SIZE = 32;

export function normalizeWeights(activeDimensions: RetrievalDimension[]) {
  const active = activeDimensions.filter((key) => RETRIEVAL_WEIGHTS[key] > 0);
  const sum = active.reduce((total, key) => total + RETRIEVAL_WEIGHTS[key], 0) || 1;
  return {
    lexical: active.includes("lexical") ? RETRIEVAL_WEIGHTS.lexical / sum : 0,
    semantic: active.includes("semantic") ? RETRIEVAL_WEIGHTS.semantic / sum : 0,
    metadata: active.includes("metadata") ? RETRIEVAL_WEIGHTS.metadata / sum : 0,
    source: active.includes("source") ? RETRIEVAL_WEIGHTS.source / sum : 0,
  };
}

export function combineRetrievalScore(
  input: {
    lexical: number | null;
    semantic: number | null;
    metadata: number;
    sourceQuality: number;
  },
  weights = normalizeWeights(["lexical", "semantic", "metadata", "source"]),
) {
  const final =
    (input.lexical || 0) * weights.lexical +
    (input.semantic || 0) * weights.semantic +
    input.metadata * weights.metadata +
    input.sourceQuality * weights.source;
  return { weights, final };
}
