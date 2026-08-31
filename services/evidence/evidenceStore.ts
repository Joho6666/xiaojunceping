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
    claims: input.claims,
    verificationStatus: input.verificationStatus,
    verifiedFields: input.verifiedFields,
    unverifiedFields: input.unverifiedFields,
    sourceClass: input.sourceClass,
  };
}

export function evidenceFromUrl(type: EvidenceType, title: string, url?: string, confidence: Evidence["confidence"] = "medium", note?: string) {
  return createEvidence({
    type,
    title,
    url,
    confidence: url?.startsWith("http") ? confidence : "low",
    note: note || (url?.startsWith("http") ? undefined : "缺少可核验 URL"),
  });
}

export function mergeEvidence(...lists: Array<Evidence[] | undefined>) {
  const byId = new Map<string, Evidence>();
  const urlOwner = new Map<string, string>();
  const idMap = new Map<string, string>();
  for (const list of lists) {
    for (const item of list || []) {
      if (!item?.id) continue;
      const url = item.url || "";
      if (url && urlOwner.has(url)) {
        const survivor = urlOwner.get(url)!;
        idMap.set(item.id, survivor);
        continue;
      }
      if (byId.has(item.id)) {
        idMap.set(item.id, item.id);
        continue;
      }
      byId.set(item.id, item);
      idMap.set(item.id, item.id);
      if (url) urlOwner.set(url, item.id);
    }
  }
  return { evidence: Array.from(byId.values()), idMap };
}

export function rewriteEvidenceIds(ids: string[] | undefined, idMap: Map<string, string>) {
  return Array.from(new Set((ids || []).map((id) => idMap.get(id) || id)));
}

export function idsOf(list: Evidence[] | undefined) {
  return (list || []).map((item) => item.id);
}
