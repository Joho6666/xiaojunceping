import { KnowledgeItem, KnowledgeSyncRun } from "../types";
import { createSyncRun, finishSyncRun, upsertKnowledgeItem } from "./knowledgeBaseService";
import { searchGithubProjects } from "./githubService";
import { extractRequirementProfile } from "./requirementExtractionService";
import { Project } from "../types";
import { syncConnectedProviderModels } from "./modelCatalogSyncService";

export async function syncKnowledge(project?: Project): Promise<KnowledgeSyncRun> {
  const run = createSyncRun();
  try {
    const queryProject = project || { id: "sync", idea: "AI 工具 Agent 模型 Skill MCP Web 电商 视频 自动化", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() } satisfies Project;
    const profile = extractRequirementProfile(queryProject);
    const projects = await searchGithubProjects(queryProject, profile.tags.slice(0, 3)).catch(() => []);
    let inserted = 0;
    for (const item of projects) {
      const knowledge: KnowledgeItem = { id: `github-${item.repo.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, kind: "github", name: item.name, summary: item.description, url: item.url, githubUrl: item.url, capabilities: item.capabilities, tags: [queryProject.kind, ...profile.tags], stack: item.stack, platforms: ["Web"], license: item.license, access: "GitHub", sourceType: "github", sourceUrl: item.url, updatedAt: item.updatedAt, verifiedAt: new Date().toISOString(), confidence: "中", publication: "published", status: "active" };
      upsertKnowledgeItem(knowledge); inserted += 1;
    }
    const modelResults = await syncConnectedProviderModels();
    inserted += modelResults.reduce((total, result) => total + result.discovered, 0);
    const modelErrors = modelResults.filter((result) => result.error).map((result) => `${result.provider}: ${result.error}`);
    return finishSyncRun(run, { status: modelErrors.length && !inserted ? "partial" : "completed", inserted, updated: 0, rejected: 0, error: modelErrors.length ? modelErrors.join("；") : undefined });
  } catch (error) {
    return finishSyncRun(run, { status: "partial", inserted: 0, updated: 0, rejected: 0, error: error instanceof Error ? error.message : "同步失败" });
  }
}
