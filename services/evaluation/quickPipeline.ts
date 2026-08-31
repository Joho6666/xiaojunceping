import { AnswerValue, Project, ProjectReport } from "../../types";
import { extractRequirementProfile } from "../requirements/extractor";
import { retrieveKnowledgeHybrid } from "../retrieval/hybrid";
import { applyKnowledgeRules } from "../knowledgeRuleEngine";
import { searchGithubProjects } from "../githubService";
import { getCapabilitySecret } from "../capabilityService";
import { buildLiveReport } from "../report/builder";
import { verifyReport } from "./verifier";
import { evaluateRequirementGate } from "./requirementGate";
import { evidenceFromUrl } from "../evidence/evidenceStore";

export async function runQuickPipeline(
  project: Project,
  answers: Record<string, AnswerValue>,
  evaluator: { provider: string; model: string; mode?: string },
): Promise<ProjectReport> {
  const profile = extractRequirementProfile(project, answers);
  const gate = evaluateRequirementGate(profile, "quick");
  const retrieved = retrieveKnowledgeHybrid(profile);
  const knowledgeMatches = applyKnowledgeRules(profile, retrieved.matches);
  const githubProjects = profile.needsGithub
    ? await searchGithubProjects(project, profile.tags.slice(0, 5), {
      githubToken: getCapabilitySecret("github"),
      profile,
    }).catch(() => [])
    : [];
  const evidence = [
    evidenceFromUrl("user-input", "项目描述", undefined, "high", project.idea.slice(0, 180)),
    ...githubProjects.slice(0, 8).map((item) => evidenceFromUrl("github", item.repo, item.url, "high")),
    ...knowledgeMatches.slice(0, 8).map((match) => evidenceFromUrl("knowledge-base", match.item.name, match.item.sourceUrl, match.item.confidence === "高" ? "high" : "medium")),
  ];
  const report = buildLiveReport({
    project,
    profile,
    githubProjects: githubProjects.slice(0, 5),
    knowledgeMatches,
    retrievalMode: retrieved.retrievalMode,
    evaluator,
    evidence,
  });
  report.requirementCompleteness = gate.completeness.score;
  if (!gate.allowed) {
    report.projectSummary.status = "needs_clarification";
    report.clarificationQuestions = gate.questions;
    report.readiness = "needs_clarification";
    report.nextActions = gate.questions;
  }
  return verifyReport(report);
}
