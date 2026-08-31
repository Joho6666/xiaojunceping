import { ProjectReport } from "../../types";
import { assertEvidenceIntegrity } from "../evidence/integrity";

export function judgeReport(report: ProjectReport) {
  const missingEvidence = assertEvidenceIntegrity(report);
  if (report.clarificationQuestions?.length) {
    return { status: "needs_clarification" as const, evidenceIds: [], criticIds: report.criticNotes || [] };
  }
  if ((report.blockingIssues || []).length || missingEvidence.length) {
    return { status: "blocked" as const, evidenceIds: (report.evidence || []).map((item) => item.id).slice(0, 8), criticIds: report.criticNotes || [] };
  }
  if ((report.unknownItems || []).some((item) => item.severity === "blocking")) {
    return { status: "revise" as const, evidenceIds: (report.evidence || []).map((item) => item.id).slice(0, 8), criticIds: report.criticNotes || [] };
  }
  return { status: "accept" as const, evidenceIds: (report.evidence || []).map((item) => item.id).slice(0, 8), criticIds: report.criticNotes || [] };
}
