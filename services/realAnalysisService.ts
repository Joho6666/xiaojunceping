import { AnswerValue, ConnectionMode, Project, ProjectReport } from "../types";
import { runQuickPipeline } from "./evaluation/quickPipeline";
import { runExpertPipeline } from "./evaluation/expertPipeline";
import { saveProjectRecord, saveEvaluationRun } from "./historyStore";
import { generateDeepSeekEvaluation } from "./deepseekService";
import { codexCliAdapter } from "../ai/cli/codexCliAdapter";

async function optionalLlmSummary(
  project: Project,
  answers: Record<string, AnswerValue>,
  evaluator: { provider: string; model?: string; secret?: string; baseUrl?: string; mode?: ConnectionMode },
) {
  if (project.evaluationMode !== "expert") return undefined;
  try {
    if (evaluator.provider === "openai" && evaluator.mode === "cli") {
      const raw = await codexCliAdapter.generateStructured<{ title?: string; verdict?: string; summary?: string; strategyReason?: string }>({
        prompt: `你是评估总结器，不是事实来源。不要编造 GitHub、Star、价格或模型 ID。只根据项目描述写 JSON：{"title":"...","verdict":"...","summary":"...","strategyReason":"..."}。项目：${JSON.stringify({ idea: project.idea, kind: project.kind })}。访谈：${JSON.stringify(answers)}。只输出 JSON。`,
        model: evaluator.model,
        timeoutMs: 120000,
        maxOutputBytes: 80_000,
      });
      return raw;
    }
    if (evaluator.secret) {
      const result = await generateDeepSeekEvaluation(project, answers, [{ type: "note", items: ["只允许总结，不允许编造仓库或价格"] }], {
        baseUrl: evaluator.baseUrl,
        model: evaluator.model,
        secret: evaluator.secret,
      });
      const data = result.data as Record<string, unknown>;
      return {
        title: typeof data.title === "string" ? data.title : undefined,
        verdict: typeof data.verdict === "string" ? data.verdict : undefined,
        summary: typeof data.summary === "string" ? data.summary : undefined,
        strategyReason: typeof (data.strategy as { reason?: string } | undefined)?.reason === "string" ? (data.strategy as { reason: string }).reason : undefined,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function runLiveAnalysis(
  project: Project,
  answers: Record<string, AnswerValue>,
  evaluator: { provider: string; model?: string; secret?: string; baseUrl?: string; mode?: ConnectionMode },
): Promise<ProjectReport> {
  const resolved = {
    provider: evaluator.provider,
    model: evaluator.model || "unspecified",
    mode: evaluator.mode,
  };
  const llmSummary = await optionalLlmSummary(project, answers, evaluator);
  const report = project.evaluationMode === "quick"
    ? await runQuickPipeline(project, answers, resolved)
    : await runExpertPipeline(project, answers, resolved, llmSummary);
  report.provider = evaluator.provider;
  report.model = resolved.model;
  report.connectionMode = evaluator.mode;
  try {
    saveProjectRecord(project, answers);
    saveEvaluationRun(project, report);
  } catch {
    // History persistence must not fail the evaluation.
  }
  return report;
}

export async function analyzeWithDeepSeek(
  project: Project,
  answers: Record<string, AnswerValue>,
  connection: { baseUrl?: string; model?: string; secret?: string; provider?: string; mode?: ConnectionMode },
): Promise<ProjectReport> {
  return runLiveAnalysis(project, answers, {
    provider: connection.provider || "deepseek",
    model: connection.model,
    secret: connection.secret,
    baseUrl: connection.baseUrl,
    mode: connection.mode || "api-key",
  });
}

export async function analyzeWithCodex(
  project: Project,
  answers: Record<string, AnswerValue>,
  model?: string,
): Promise<ProjectReport> {
  return runLiveAnalysis(project, answers, {
    provider: "openai",
    model,
    mode: "cli",
  });
}
