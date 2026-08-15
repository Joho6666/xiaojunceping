import assert from "node:assert/strict";
import { listKnowledgeItems } from "../services/knowledgeBaseService";
import { KnowledgeKind } from "../types";

const items = listKnowledgeItems();
const names = new Set(items.map((entry) => entry.name));
const has = (needle: string) => items.some((entry) => entry.name.toLowerCase().includes(needle.toLowerCase()) || entry.modelId?.toLowerCase().includes(needle.toLowerCase()));

assert.ok(items.length >= 110, `knowledge base should contain at least 110 published entries, got ${items.length}`);
for (const expected of ["GPT Image 2", "Nano Banana 2（Gemini 3.1 Flash Image）", "FLUX.2 Pro", "Stable Diffusion 3.5 Large", "Qwen-Image", "ComfyUI", "Replicate", "vLLM", "OpenHands", "LangGraph", "MCP Python SDK", "Playwright MCP", "MCP Registry API", "TRAE / TraeWork", "WorkBuddy", "ZCode", "DeepSeek Harness"]) {
  assert.ok(names.has(expected), `missing curated entry: ${expected}`);
}

const media = items.filter((entry) => entry.modelCapabilities?.some((capability) => /image|video|audio/i.test(capability)));
assert.ok(media.length >= 12, `expected at least 12 media-capable models, got ${media.length}`);
assert.ok(has("gpt-image-2"));
assert.ok(has("gemini-3.1-flash-image"));
assert.ok(has("flux-2-pro-preview"));
for (const agent of ["TRAE / TraeWork", "WorkBuddy", "ZCode", "DeepSeek Harness"]) {
  const entry = items.find((candidate) => candidate.name === agent);
  assert.ok(entry?.pricingDetails, `${agent} must expose structured pricing metadata`);
  assert.ok(entry?.summary.includes("适合") || entry?.summary.includes("支持"), `${agent} must describe practical effectiveness`);
}

for (const entry of items) {
  assert.ok(entry.sourceUrl.startsWith("http"), `${entry.name} must have a source URL`);
  assert.ok(entry.updatedAt, `${entry.name} must have an update timestamp`);
  if (entry.kind === "llm" && entry.modelCapabilities?.length) assert.ok(entry.modalities?.length, `${entry.name} must declare modalities when capabilities are detailed`);
}

const kinds = new Set(items.map((entry) => entry.kind));
for (const kind of ["llm", "agent", "ai-tool", "skill", "mcp", "plugin", "github"]) assert.ok(kinds.has(kind as KnowledgeKind), `missing knowledge category: ${kind}`);
console.log(`knowledge coverage passed: ${items.length} entries, ${media.length} media-capable models`);
