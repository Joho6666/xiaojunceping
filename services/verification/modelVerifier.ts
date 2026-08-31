import { listConnections } from "../connectionService";
import { assertSafeHttpUrl } from "../net/safeFetch";

export type ModelAvailability = "available" | "unavailable" | "unknown";

export function verifyConfiguredModel(provider?: string, modelId?: string): ModelAvailability {
  if (!provider || !modelId) return "unknown";
  const match = listConnections().find((item) => item.provider === provider && item.status === "connected");
  if (!match) return "unknown";
  if (match.baseUrl) {
    try {
      assertSafeHttpUrl(match.baseUrl);
    } catch {
      return "unavailable";
    }
  }
  if (match.model && match.model !== modelId) return "unknown";
  return "available";
}

export function modelRankingBreakdown(input: { coding?: number; toolUse?: number; vision?: number; cost?: number; availability: ModelAvailability }) {
  return {
    codingFit: input.coding,
    toolFit: input.toolUse,
    visionFit: input.vision,
    costFit: input.cost,
    availability: input.availability,
    evidenceConfidence: input.coding == null && input.toolUse == null && input.vision == null ? "unknown" as const : "medium" as const,
  };
}
