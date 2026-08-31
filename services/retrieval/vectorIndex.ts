import { cosineSimilarity } from "./embedding";

export interface VectorHit {
  id: string;
  score: number;
}

/**
 * In-memory brute-force index. Swap later for ANN / pgvector / Qdrant / sqlite-vec
 * without changing retrieveKnowledgeHybridAsync.
 */
export interface VectorIndex {
  upsert(id: string, vector: number[]): void;
  search(queryVector: number[], k: number): VectorHit[];
}

export class BruteForceVectorIndex implements VectorIndex {
  private vectors = new Map<string, number[]>();

  upsert(id: string, vector: number[]) {
    if (id && vector.length) this.vectors.set(id, vector);
  }

  search(queryVector: number[], k: number): VectorHit[] {
    if (!queryVector.length || k <= 0) return [];
    return Array.from(this.vectors.entries())
      .map(([id, vector]) => ({ id, score: cosineSimilarity(queryVector, vector) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
