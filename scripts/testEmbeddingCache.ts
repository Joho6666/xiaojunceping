import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KnowledgeItem } from "../types";
import { EmbeddingProvider } from "../services/retrieval/embedding";
import { EMBEDDING_BATCH_SIZE } from "../services/retrieval/weights";

(async () => {
  process.env.AGENTSCOPE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "emb-cache-"));
  const { contentHash, getCachedEmbedding, setCachedEmbedding } = await import("../services/retrieval/embeddingCache");
  const hash = contentHash("hello");
  assert.equal(getCachedEmbedding("a", "m", hash), null);
  setCachedEmbedding("a", "m", hash, [0.1, 0.2]);
  assert.deepEqual(getCachedEmbedding("a", "m", hash), [0.1, 0.2]);
  assert.equal(getCachedEmbedding("a", "m", contentHash("other")), null);

  function fakeItem(id: string, name: string): KnowledgeItem {
    return {
      id,
      kind: "ai-tool",
      name,
      summary: name,
      capabilities: [],
      tags: [name],
      stack: [],
      platforms: [],
      sourceType: "official",
      sourceUrl: "https://example.com",
      updatedAt: "2026-01-01",
      confidence: "中",
      publication: "published",
      status: "active",
    };
  }

  const batches: number[] = [];
  class CountingEmbedding implements EmbeddingProvider {
    id = "mock";
    available() { return true; }
    async embed(texts: string[]) {
      batches.push(texts.length);
      assert.ok(texts.length <= EMBEDDING_BATCH_SIZE);
      return texts.map((text) => (text.includes("needle-unique-term") || text.includes("query-needle") ? [1, 0] : [0, 1]));
    }
  }

  process.env.EMBEDDING_MODEL = "mock-embed";
  const { retrieveKnowledgeHybridAsync } = await import("../services/retrieval/hybrid");
  const items = Array.from({ length: 40 }, (_, index) => fakeItem(`cache-${index + 1}`, index === 39 ? "needle-unique-term" : `generic ${index}`));
  const profile = {
    projectKind: "general" as const,
    domain: ["web"],
    goals: ["query-needle"],
    capabilities: [],
    tags: [],
    stack: [],
    platforms: [],
    constraints: [],
    dataSensitivity: "未知" as const,
    needsLiveSearch: false,
    requiredFeatures: ["needle-unique-term"],
  };
  const first = await retrieveKnowledgeHybridAsync(profile, items, new CountingEmbedding());
  assert.equal(first.retrievalMode, "hybrid");
  assert.ok(batches.some((size) => size === EMBEDDING_BATCH_SIZE));
  assert.ok(first.matches.some((match) => match.item.id === "cache-40"));
  const secondBatches = batches.length;
  const second = await retrieveKnowledgeHybridAsync(profile, items, new CountingEmbedding());
  assert.equal(second.retrievalMode, "hybrid");
  assert.equal(batches.length, secondBatches, "cache hits must not re-embed corpus vectors");
  assert.ok(second.matches.some((match) => match.item.id === "cache-40"));
  console.log("embedding cache tests passed");
})();
