import { EMBEDDING_BATCH_SIZE } from "./weights";

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

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  id = "openai-compatible";
  constructor(private options: { baseUrl: string; apiKey: string; model: string }) {}
  available() {
    return Boolean(this.options.baseUrl && this.options.apiKey && this.options.model);
  }
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.available() || !texts.length) return [];
    const output: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const origin = this.options.baseUrl.replace(/\/$/, "");
      const response = await fetch(`${origin}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.apiKey}` },
        body: JSON.stringify({ model: this.options.model, input: batch }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`EMBEDDING_HTTP_${response.status}`);
      const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
      const vectors = (data.data || []).map((item) => item.embedding || []);
      if (vectors.length !== batch.length) throw new Error("EMBEDDING_BATCH_MISMATCH");
      output.push(...vectors);
    }
    return output;
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
  const baseUrl = process.env.EMBEDDING_BASE_URL || process.env.OPENAI_BASE_URL || "";
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || "";
  const model = process.env.EMBEDDING_MODEL || "";
  if (baseUrl && apiKey && model) return new OpenAICompatibleEmbeddingProvider({ baseUrl, apiKey, model });
  return new UnavailableEmbeddingProvider();
}
