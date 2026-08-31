import { ProjectReport, QuickReportView } from '../types';

export function getQuickReport(report: ProjectReport): QuickReportView {
  const primaryAgent = report.agents[0];
  const execution = report.models.filter((model) => model.roleKind === "execution");
  const primaryModels = (execution.length ? execution : report.models.filter((model) => model.roleKind !== "evaluator")).slice(0, 2);
  const humanEffort = report.estimates.humanEffort || {
    display: "unknown",
    range: "insufficient_evidence",
    confidence: "低" as const,
    breakdown: [],
  };
  return {
    title: report.projectSummary.title,
    status: report.projectSummary.status,
    verdict: report.projectSummary.verdict,
    summary: report.projectSummary.summary,
    strategy: report.strategy,
    primaryAgent,
    primaryModels: primaryModels.length ? primaryModels : report.models.slice(0, 2),
    githubProjects: report.githubProjects.slice(0, 3),
    estimates: {
      time: report.estimates.time,
      tokens: report.estimates.tokens,
      cost: report.estimates.cost,
      humanEffort,
    },
    workflow: report.workflows.slice(0, 5).map(({ id, title, goal, time }) => ({ id, title, goal, time })),
    risks: report.risks.slice(0, 3),
    acceptanceCriteria: report.projectSummary.acceptanceCriteria,
  };
}
