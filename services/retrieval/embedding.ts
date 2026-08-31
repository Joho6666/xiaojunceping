export interface EmbeddingProvider {
  id: string;
  available(): boolean;
  embed(texts: string[]): Promise<number[][]>;
}

export class UnavailableEmbeddingProvider implements EmbeddingProvider {
  id = "none";
  available() {
    return false;
  }
  async embed(): Promise<number[][]> {
    return [];
  }
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / Math.sqrt(na * nb);
}

export function createEmbeddingProvider(): EmbeddingProvider {
  return new UnavailableEmbeddingProvider();
}
