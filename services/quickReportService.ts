import { ProjectReport, QuickReportView } from '../types';

export function getQuickReport(report:ProjectReport):QuickReportView {
  const primaryAgent = report.agents[0];
  const primaryModels = report.models.filter(model=>model.matchScore>=90).slice(0,2);
  const humanEffort = report.estimates.humanEffort || {display:'约 5–10 小时',range:'人工参与与验收时间',confidence:'中' as const,breakdown:[]};
  return {title:report.projectSummary.title,status:report.projectSummary.status,verdict:report.projectSummary.verdict,summary:report.projectSummary.summary,strategy:report.strategy,primaryAgent,primaryModels,githubProjects:report.githubProjects.slice(0,3),estimates:{time:report.estimates.time,tokens:report.estimates.tokens,cost:report.estimates.cost,humanEffort},workflow:report.workflows.slice(0,5).map(({id,title,goal,time})=>({id,title,goal,time})),risks:report.risks.slice(0,3),acceptanceCriteria:report.projectSummary.acceptanceCriteria};
}
