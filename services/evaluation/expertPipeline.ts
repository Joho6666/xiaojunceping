import { AnswerValue, Project, ProjectReport } from "../../types";
import { extractRequirementProfile } from "../requirements/extractor";
import { retrieveKnowledgeHybrid } from "../retrieval/hybrid";
import { applyKnowledgeRules } from "../knowledgeRuleEngine";
import { searchGithubProjects } from "../githubService";
import { getCapabilitySecret } from "../capabilityService";
import { searchBrowserSources } from "../browserSearchService";
import { verifyGithubUrls } from "../githubService";
import { buildLiveReport } from "../report/builder";
import { verifyReport } from "./verifier";
import { critiqueReport } from "./critic";
import { evidenceFromUrl } from "../evidence/evidenceStore";

export async function runExpertPipeline(
  project: Project,
  answers: Record<string, AnswerValue>,
  evaluator: { provider: string; model: string; mode?: string },
  llmSummary?: { title?: string; verdict?: string; summary?: string; strategyReason?: string },
): Promise<ProjectReport> {
  const profile = extractRequirementProfile(project, answers);
  const retrieved = retrieveKnowledgeHybrid(profile);
  const knowledgeMatches = applyKnowledgeRules(profile, retrieved.matches);
  const browserSearch = await searchBrowserSources(project, profile).catch(() => ({ queries: [], results: [] as Array<{ url: string; title?: string }>, searchedAt: undefined, error: "browser search failed" }));
  let githubProjects = await searchGithubProjects(project, [...profile.tags, ...profile.capabilities].slice(0, 8), {
    githubToken: getCapabilitySecret("github"),
    profile,
  }).catch(() => []);
  const browserGithub = await verifyGithubUrls(project, browserSearch.results.map((result) => result.url), {
    githubToken: getCapabilitySecret("github"),
    profile,
  }).catch(() => []);
  const seen = new Set(githubProjects.map((item) => item.repo.toLowerCase()));
  githubProjects = [...githubProjects, ...browserGithub.filter((item) => !seen.has(item.repo.toLowerCase()))];
  const evidence = [
    evidenceFromUrl("user-input", "项目描述与访谈", undefined, "high", project.idea.slice(0, 180)),
    ...githubProjects.slice(0, 12).map((item) => evidenceFromUrl("github", item.repo, item.url, "high", item.advice)),
    ...knowledgeMatches.slice(0, 12).map((match) => evidenceFromUrl("knowledge-base", match.item.name, match.item.sourceUrl, match.item.confidence === "高" ? "high" : "medium")),
    ...browserSearch.results.slice(0, 8).map((result) => evidenceFromUrl("official", result.title || result.url, result.url, "medium", "UNTRUSTED web content; metadata only")),
  ];
  const draft = buildLiveReport({
    project,
    profile,
    githubProjects: githubProjects.slice(0, 12),
    knowledgeMatches,
    retrievalMode: retrieved.retrievalMode,
    evaluator,
    evidence,
    llmSummary,
  });
  draft.criticNotes = critiqueReport(profile, draft);
  draft.knowledge = {
    ...draft.knowledge!,
    liveSearchAt: githubProjects.some((item) => item.source === "live") ? new Date().toISOString() : undefined,
    browserSearch: {
      queries: browserSearch.queries,
      resultCount: browserSearch.results.length,
      searchedAt: browserSearch.searchedAt,
      error: browserSearch.error,
    },
  };
  return verifyReport(draft);
}
