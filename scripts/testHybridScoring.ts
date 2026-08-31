import assert from "node:assert/strict";
import { combineRetrievalScore, normalizeWeights } from "../services/retrieval/weights";

const hybrid = normalizeWeights(["lexical", "semantic", "metadata", "source"]);
assert.ok(Math.abs(hybrid.lexical + hybrid.semantic + hybrid.metadata + hybrid.source - 1) < 1e-9);

const lexicalOnly = normalizeWeights(["lexical", "metadata", "source"]);
assert.ok(lexicalOnly.semantic === 0);
assert.ok(Math.abs(lexicalOnly.lexical + lexicalOnly.metadata + lexicalOnly.source - 1) < 1e-9);
assert.ok(lexicalOnly.lexical > 0.5);

const lexicalRun = combineRetrievalScore({ lexical: 1, semantic: null, metadata: 1, sourceQuality: 1 }, lexicalOnly);
assert.ok(lexicalRun.final > 0.9);

const both = combineRetrievalScore({ lexical: 1, semantic: 1, metadata: 0, sourceQuality: 0 });
assert.ok(both.final > 0.7);

const hybridHit = combineRetrievalScore({ lexical: 0.7, semantic: 0.9, metadata: 0.3, sourceQuality: 0.7 });
const lexicalOfficial = combineRetrievalScore({ lexical: 0.5, semantic: null, metadata: 0.6, sourceQuality: 1 });
assert.ok(hybridHit.final > lexicalOfficial.final, "missing semantic must not inflate lexical-only official items");
console.log("hybrid scoring tests passed");
