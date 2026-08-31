import assert from "node:assert/strict";
import { verifyConfiguredModel, modelRankingBreakdown } from "../services/verification/modelVerifier";

assert.equal(verifyConfiguredModel(), "unknown");
assert.equal(verifyConfiguredModel("deepseek", "x"), "unknown");
const breakdown = modelRankingBreakdown({ availability: "unknown" });
assert.equal(breakdown.codingFit, undefined);
assert.equal(breakdown.evidenceConfidence, "unknown");

import { extractRequirementProfile } from "../services/requirements/extractor";
import { scoreExecutionModels } from "../services/recommendation/modelScorer";
const profile = extractRequirementProfile({ id: "m", idea: "STM32 固件 Keil", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() });
const scored = scoreExecutionModels(profile, { provider: "deepseek", model: "deepseek-v4-flash" });
assert.ok(!scored.models.some((item) => /claude|codex|deepseek/i.test(item.name) && item.reason.includes("适合代码") && !(item.capabilityProfile?.coding != null)));
console.log("model verification tests passed");
