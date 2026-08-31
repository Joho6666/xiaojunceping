import assert from "node:assert/strict";
import { BM25Index } from "../services/retrieval/bm25Index";
import { tokenize } from "../services/retrieval/tokenizer";
import { createEmbeddingProvider } from "../services/retrieval/embedding";

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
console.log("retrieval tests passed");
