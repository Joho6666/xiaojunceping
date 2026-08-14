import { ProjectReport } from "../types";

export async function getReport(projectId: string): Promise<ProjectReport | null> {
  const response = await fetch(`/api/projects/${projectId}/report`, { cache: "no-store" });
  if (!response.ok) return null;
  const data = (await response.json()) as { report?: ProjectReport };
  return data.report ?? null;
}

export async function rerunAnalysis(projectId: string): Promise<boolean> {
  const response = await fetch(`/api/projects/${projectId}/report`, { method: "DELETE" });
  return response.ok;
}
