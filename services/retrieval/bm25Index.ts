import { tokenize } from "./tokenizer";

export interface IndexedDocument {
  id: string;
  text: string;
  tokens: string[];
}

export class BM25Index {
  documents: IndexedDocument[] = [];
  df = new Map<string, number>();
  avgDl = 1;
  constructor(entries: Array<{ id: string; text: string }>) {
    this.documents = entries.map((entry) => ({ id: entry.id, text: entry.text, tokens: tokenize(entry.text) }));
    for (const doc of this.documents) {
      const unique = new Set(doc.tokens);
      Array.from(unique).forEach((token) => this.df.set(token, (this.df.get(token) || 0) + 1));
    }
    this.avgDl = this.documents.reduce((sum, doc) => sum + doc.tokens.length, 0) / Math.max(this.documents.length, 1);
  }
  idf(token: string) {
    const df = this.df.get(token) || 0;
    const n = this.documents.length;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }
  score(query: string, doc: IndexedDocument, k1 = 1.2, b = 0.75) {
    const queryTokens = tokenize(query);
    const tf = new Map<string, number>();
    for (const token of doc.tokens) tf.set(token, (tf.get(token) || 0) + 1);
    let score = 0;
    for (const token of queryTokens) {
      const freq = tf.get(token) || 0;
      if (!freq) continue;
      const idf = this.idf(token);
      score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (doc.tokens.length / this.avgDl))));
    }
    return score;
  }
  rank(query: string, limit = 30) {
    return this.documents
      .map((doc) => ({ id: doc.id, score: this.score(query, doc) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
