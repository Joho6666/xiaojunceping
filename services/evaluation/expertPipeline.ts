import { AnswerValue, Project, ProjectReport, RequirementProfile } from "../../types";
import { extractRequirementProfile } from "../requirements/extractor";
import { retrieveKnowledgeHybridAsync } from "../retrieval/hybrid";
import { applyKnowledgeRules } from "../knowledgeRuleEngine";
import { searchGithubProjects } from "../githubService";
import { getCapabilitySecret } from "../capabilityService";
import { searchBrowserSources } from "../browserSearchService";
import { verifyGithubUrls } from "../githubService";
import { buildLiveReport } from "../report/builder";
import { verifyReport } from "./verifier";
import { critiqueReport, structuredCritique } from "./critic";
import { runLlmCritic } from "./llmCritic";
import { judgeReport } from "./finalJudge";
import { evaluateRequirementGate } from "./requirementGate";
import { evidenceFromUrl } from "../evidence/evidenceStore";
import { classifySourceUrl } from "../verification/sourceVerifier";
import { verifyGithubRecommendation } from "../verification/githubVerifier";
import { planArchitecture } from "./architect";

export function analyzeRequirement(project: Project, answers: Record<string, AnswerValue>) {
  const profile = extractRequirementProfile(project, answers);
  const gate = evaluateRequirementGate(profile, "expert");
  return { profile, gate };
}

export async function researchSources(project: Project, profile: RequirementProfile) {
  const retrieved = await retrieveKnowledgeHybridAsync(profile);
  const knowledgeMatches = applyKnowledgeRules(profile, retrieved.matches);
  const browserSearch = await searchBrowserSources(project, profile).catch(() => ({ queries: [] as string[], results: [] as Array<{ url: string; title?: string }>, searchedAt: undefined, error: "browser search failed" }));
  let githubProjects = profile.needsGithub
    ? await searchGithubProjects(project, [...profile.tags, ...profile.capabilities].slice(0, 8), {
      githubToken: getCapabilitySecret("github"),
      profile,
    }).catch(() => [])
    : [];
  const browserGithub = await verifyGithubUrls(project, browserSearch.results.map((result) => result.url), {
    githubToken: getCapabilitySecret("github"),
    profile,
  }).catch(() => []);
  const seen = new Set(githubProjects.map((item) => item.repo.toLowerCase()));
  githubProjects = [...githubProjects, ...browserGithub.filter((item) => !seen.has(item.repo.toLowerCase()))];
  return { retrieved, knowledgeMatches, browserSearch, githubProjects };
}

export async function verifyGithubFacts(githubProjects: Awaited<ReturnType<typeof researchSources>>["githubProjects"]) {
  const githubToken = getCapabilitySecret("github");
  return Promise.all(
    githubProjects.slice(0, 8).map((item) =>
      verifyGithubRecommendation(item, githubToken).catch(() => ({ ...item, verificationStatus: "unverified" as const })),
    ),
  );
}

export function designArchitecture(profile: RequirementProfile) {
  return planArchitecture(profile);
}

export async function runOptionalLlmCritic(profile: RequirementProfile, report: ProjectReport) {
  return runLlmCritic(profile, report);
}

export async function runExpertPipeline(
  project: Project,
  answers: Record<string, AnswerValue>,
  evaluator: { provider: string; model: string; mode?: string },
  llmSummary?: { title?: string; verdict?: string; summary?: string; strategyReason?: string },
): Promise<ProjectReport> {
  const { profile, gate } = analyzeRequirement(project, answers);
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
      validExecutionPlan: false,
    });
    report.projectSummary.status = "needs_clarification";
    report.readiness = "needs_clarification";
    report.clarificationQuestions = gate.questions;
    report.nextActions = gate.questions;
    report.requirementCompleteness = gate.completeness.score;
    return verifyReport(report);
  }

  const researched = await researchSources(project, profile);
  const githubProjects = await verifyGithubFacts(researched.githubProjects);
  const architecture = designArchitecture(profile);
  const evidence = [
    evidenceFromUrl("user-input", "项目描述与访谈", undefined, "high", project.idea.slice(0, 180)),
    ...researched.browserSearch.results.slice(0, 8).map((result) => {
      const ev = evidenceFromUrl("official", result.title || result.url, result.url, "medium", "UNTRUSTED web content");
      return { ...ev, type: "official" as const, sourceClass: classifySourceUrl(result.url), note: "UNTRUSTED web content; metadata only" };
    }),
  ];
  const draft = buildLiveReport({
    project,
    profile,
    githubProjects: githubProjects.slice(0, 12),
    knowledgeMatches: researched.knowledgeMatches,
    retrievalMode: researched.retrieved.retrievalMode,
    evaluator,
    evidence,
    llmSummary,
    validExecutionPlan: true,
  });
  draft.architectureDetail = architecture;
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
      queries: researched.browserSearch.queries,
      resultCount: researched.browserSearch.results.length,
      searchedAt: researched.browserSearch.searchedAt,
      error: researched.browserSearch.error,
    },
  };
  draft.requirementCompleteness = gate.completeness.score;
  const llm = await runOptionalLlmCritic(profile, draft);
  draft.criticNotes = Array.from(new Set([...(draft.criticNotes || []), ...llm.warnings, ...llm.blockingIssues]));
  const judged = judgeReport(draft);
  draft.judgeStatus = judged.status;
  draft.criticIds = judged.criticIds;
  draft.judgeEvidenceIds = judged.evidenceIds;
  return verifyReport(draft);
}
