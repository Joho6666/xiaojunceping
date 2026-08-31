import { Evidence, ProjectReport, RequirementProfile } from "../../types";

export function assertEvidenceIntegrity(report: ProjectReport): string[] {
  const store = new Map((report.evidence || []).map((item) => [item.id, item]));
  const missing: string[] = [];
  const check = (owner: string, ids?: string[]) => {
    for (const id of ids || []) {
      if (!store.has(id)) missing.push(`${owner}:${id}`);
    }
  };
  (report.agents || []).forEach((item) => check(`agent:${item.id}`, item.evidenceIds));
  (report.models || []).forEach((item) => check(`model:${item.id}`, item.evidenceIds));
  (report.githubProjects || []).forEach((item) => check(`github:${item.id}`, item.evidenceIds));
  (report.techStack || []).forEach((item) => check(`stack:${item.name}`, item.evidenceIds));
  (report.tools || []).forEach((item, index) => check(`tool:${item.name}:${index}`, item.evidenceIds));
  (report.ecosystem || []).forEach((item) => check(`ecosystem:${item.id}`, item.evidenceIds));
  (report.decisionLog || []).forEach((item) => check(`decision:${item.decision}`, item.evidenceIds));
  return missing;
}

export function criticalEvidenceCoverage(report: ProjectReport, profile?: RequirementProfile) {
  const store = new Set((report.evidence || []).map((item) => item.id));
  const needsGithub = profile?.needsGithub ?? true;
  const architectureIds = [
    ...(report.agents || []).flatMap((item) => item.evidenceIds || []),
    ...(report.evidence || []).filter((item) => item.type === "knowledge-base").map((item) => item.id),
  ];
  const costIds = (report.evidence || []).filter((item) => item.type === "calculation").map((item) => item.id);
  const critical: Array<{ key: string; ids: string[]; required: boolean }> = [
    { key: "architecture", ids: architectureIds, required: true },
    { key: "models", ids: (report.models || []).flatMap((item) => item.evidenceIds || []), required: true },
    { key: "github", ids: (report.githubProjects || []).flatMap((item) => item.evidenceIds || []), required: needsGithub },
    { key: "feasibility", ids: (report.decisionLog || []).flatMap((item) => item.evidenceIds || []), required: true },
    { key: "license", ids: (report.githubProjects || []).flatMap((item) => item.evidenceIds || []), required: needsGithub },
    { key: "cost", ids: costIds, required: true },
    { key: "tools", ids: (report.tools || []).flatMap((item) => item.evidenceIds || []), required: false },
  ];
  const relevant = critical.filter((item) => item.required || item.ids.length);
  const covered = relevant.filter((item) => item.ids.length && item.ids.every((id) => store.has(id)));
  const blocking = critical.filter((item) => item.required && (!item.ids.length || item.ids.some((id) => !store.has(id))));
  const warnings = critical.filter((item) => !item.required && item.ids.some((id) => !store.has(id))).map((item) => item.key);
  return {
    coverage: relevant.length ? covered.length / relevant.length : 1,
    blocking: blocking.map((item) => item.key),
    warnings,
  };
}

export function evidenceWithClaim(evidence: Evidence, field: string, statement: string): Evidence {
  const existing = evidence.claims || [];
  if (existing.some((claim) => claim.field === field && claim.statement === statement)) return evidence;
  return {
    ...evidence,
    claims: [...existing, { id: `${evidence.id}-${field}`, statement, field, verificationStatus: evidence.verificationStatus || "unverified" }],
  };
}
