import { Evidence, EvidenceType } from "../../types";

let counter = 0;

export function createEvidence(input: Omit<Evidence, "id"> & { id?: string }): Evidence {
  counter += 1;
  return {
    id: input.id || `ev-${Date.now().toString(36)}-${counter}`,
    type: input.type,
    title: input.title,
    url: input.url,
    retrievedAt: input.retrievedAt || new Date().toISOString(),
    verifiedAt: input.verifiedAt,
    confidence: input.confidence,
    note: input.note,
  };
}

export function evidenceFromUrl(type: EvidenceType, title: string, url?: string, confidence: Evidence["confidence"] = "medium", note?: string) {
  return createEvidence({
    type,
    title,
    url,
    confidence: url?.startsWith("http") ? confidence : "low",
    verifiedAt: url?.startsWith("http") ? new Date().toISOString() : undefined,
    note: note || (url?.startsWith("http") ? undefined : "缺少可核验 URL"),
  });
}

export function mergeEvidence(...lists: Array<Evidence[] | undefined>) {
  const seen = new Set<string>();
  const result: Evidence[] = [];
  for (const list of lists) {
    for (const item of list || []) {
      const key = item.url || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function idsOf(list: Evidence[] | undefined) {
  return (list || []).map((item) => item.id);
}
