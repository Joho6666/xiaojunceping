import { AnswerValue, Project, ProjectReport } from "../../types";
import { extractRequirementProfile } from "../requirements/extractor";
import { retrieveKnowledgeHybridAsync } from "../retrieval/hybrid";
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
  if (!gate.allowed) {
    const report = buildLiveReport({
      project,
      profile,
      githubProjects: [],
      knowledgeMatches: [],
      retrievalMode: "lexical",
      evaluator,
      evidence: [evidenceFromUrl("user-input", "需求不完整", undefined, "low", "Quick 评估已拦截")],
      validExecutionPlan: false,
    });
    report.projectSummary.status = "needs_clarification";
    report.readiness = "needs_clarification";
    report.clarificationQuestions = gate.questions;
    report.nextActions = gate.questions;
    report.requirementCompleteness = gate.completeness.score;
    report.validExecutionPlan = false;
    return verifyReport(report);
  }

  const retrieved = await retrieveKnowledgeHybridAsync(profile);
  const knowledgeMatches = applyKnowledgeRules(profile, retrieved.matches);
  const githubProjects = profile.needsGithub
    ? await searchGithubProjects(project, profile.tags.slice(0, 5), {
      githubToken: getCapabilitySecret("github"),
      profile,
    }).catch(() => [])
    : [];
  const evidence = [evidenceFromUrl("user-input", "项目描述", undefined, "high", project.idea.slice(0, 180))];
  const report = buildLiveReport({
    project,
    profile,
    githubProjects: githubProjects.slice(0, 5),
    knowledgeMatches,
    retrievalMode: retrieved.retrievalMode,
    evaluator,
    evidence,
    validExecutionPlan: true,
  });
  report.requirementCompleteness = gate.completeness.score;
  return verifyReport(report);
}
