import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BM25Index } from "../services/retrieval/bm25Index";
import { tokenize } from "../services/retrieval/tokenizer";
import { createEmbeddingProvider, EmbeddingProvider } from "../services/retrieval/embedding";
import { KnowledgeItem } from "../types";

const tokens = tokenize("校园交友平台");
assert.ok(tokens.includes("校园"));
assert.ok(tokens.includes("交友"));
assert.ok(tokens.includes("校园交友"));

const index = new BM25Index([
  { id: "common", text: "website website website website" },
  { id: "rare", text: "ds18b20 temperature firmware" },
]);
const ranked = index.rank("ds18b20 firmware");
assert.ok(ranked[0].id === "rare");

const provider = createEmbeddingProvider();
if (!provider.available()) assert.equal(provider.id, "none");

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

class MockEmbedding implements EmbeddingProvider {
  id = "mock";
  available() { return true; }
  async embed(texts: string[]) {
    return texts.map((text) => {
      if (text.includes("needle-unique-term")) return [1, 0, 0];
      if (text.includes("query-needle")) return [1, 0, 0];
      return [0, 1, 0];
    });
  }
}

(async () => {
  process.env.AGENTSCOPE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "retrieval-"));
  const { retrieveKnowledgeHybridAsync } = await import("../services/retrieval/hybrid");
  const items = Array.from({ length: 200 }, (_, index) => fakeItem(`item-${index + 1}`, index === 199 ? "needle-unique-term semantic hit" : `generic tool ${index}`));
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
  const retrieved = await retrieveKnowledgeHybridAsync(profile, items, new MockEmbedding());
  assert.equal(retrieved.retrievalMode, "hybrid");
  assert.ok(retrieved.matches.some((match) => match.item.id === "item-200"), "semantic candidate 200 must enter top-k");
  console.log("retrieval tests passed");
})();
