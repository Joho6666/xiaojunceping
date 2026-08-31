import { AnswerValue, Project } from "../types";
import { detectProjectKind } from "../data/questions";
import { extractRequirementProfile } from "./requirementExtractionService";

export async function createProjectRecord(idea: string): Promise<Project> {
  return { id: crypto.randomUUID(), idea, kind: detectProjectKind(idea), evaluationMode: "quick", createdAt: new Date().toISOString() };
}

export function getRequirementPreview(project: Project, answers: Record<string, AnswerValue> = {}) {
  const profile = extractRequirementProfile(project, answers);
  return {
    title: project.idea.slice(0, 36) || "未命名项目",
    typeLabel: profile.domain?.join(" / ") || project.kind,
    summary: project.idea,
    verdict: "需求预览：完成分析后生成结论",
    score: Math.round((profile.completeness?.score || 0) * 100),
    status: profile.completeness && profile.completeness.score >= 0.55 ? "可进入分析" : "待补齐",
    acceptanceCriteria: profile.acceptanceCriteria || [],
  };
}
