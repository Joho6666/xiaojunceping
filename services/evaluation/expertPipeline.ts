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
import { critiqueReport, structuredCritique } from "./critic";
import { evaluateRequirementGate } from "./requirementGate";
import { evidenceFromUrl } from "../evidence/evidenceStore";
import { classifySourceUrl } from "../verification/sourceVerifier";

export async function runExpertPipeline(
  project: Project,
  answers: Record<string, AnswerValue>,
  evaluator: { provider: string; model: string; mode?: string },
  llmSummary?: { title?: string; verdict?: string; summary?: string; strategyReason?: string },
): Promise<ProjectReport> {
  const profile = extractRequirementProfile(project, answers);
  const gate = evaluateRequirementGate(profile, "expert");
  if (!gate.allowed) {
    const report = buildLiveReport({
      project,
      profile,
      githubProjects: [],
      knowledgeMatches: [],
      retrievalMode: "lexical",
      evaluator,
      evidence: [evidenceFromUrl("user-input", "需求不完整", undefined, "low", "Expert Architecture 已拦截")],
      llmSummary: { verdict: "需求不足，不能进入架构设计", summary: `完整度 ${(gate.completeness.score * 100).toFixed(0)}%。请先回答关键问题。` },
    });
    report.projectSummary.status = "needs_clarification";
    report.readiness = "needs_clarification";
    report.clarificationQuestions = gate.questions;
    report.nextActions = gate.questions;
    report.requirementCompleteness = gate.completeness.score;
    return verifyReport(report);
  }
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
    ...browserSearch.results.slice(0, 8).map((result) => {
      const ev = evidenceFromUrl("official", result.title || result.url, result.url, "medium", "UNTRUSTED web content");
      return { ...ev, type: "official" as const, sourceClass: classifySourceUrl(result.url), note: "UNTRUSTED web content; metadata only" };
    }),
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
  const critique = structuredCritique(profile, draft);
  draft.criticNotes = critiqueReport(profile, draft);
  draft.blockingIssues = Array.from(new Set([...(draft.blockingIssues || []), ...critique.blockingIssues]));
  if (critique.blockingIssues.length) {
    draft.projectSummary.status = "needs_confirmation";
    draft.readiness = "blocked";
  }
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
  draft.requirementCompleteness = gate.completeness.score;
  return verifyReport(draft);
}
