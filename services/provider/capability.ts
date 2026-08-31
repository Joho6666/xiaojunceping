import { ProviderCapabilityState, ProviderId } from "../../types";

const EVALUATION: Record<ProviderId, ProviderCapabilityState> = {
  openai: "available",
  deepseek: "available",
  custom: "available",
  anthropic: "partial",
  gemini: "partial",
};

export function evaluationCapability(provider: ProviderId): ProviderCapabilityState {
  return EVALUATION[provider] || "unsupported";
}

export function canEvaluate(provider: ProviderId) {
  return evaluationCapability(provider) === "available";
}

export function capabilityMessage(provider: ProviderId) {
  const state = evaluationCapability(provider);
  if (state === "available") return `${provider} 可用于真实评估`;
  if (state === "partial") return `${provider} 连接可保存，但评估引擎尚未启用该适配器。请使用 Codex CLI、DeepSeek 或 OpenAI-compatible API。`;
  return `${provider} 当前不支持评估`;
}
