import { NextRequest, NextResponse } from 'next/server';
import { resolveAnyEvaluationProvider, resolveProvider } from '../../../../../services/providerService';
import { analyzeWithCodex, analyzeWithDeepSeek } from '../../../../../services/realAnalysisService';
import { saveStoredReport } from '../../../../../services/reportStore';
import { Project, AnswerValue } from '../../../../../types';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let body: { project?: Project; answers?: Record<string, AnswerValue> };
  try {
    body = await request.json() as { project?: Project; answers?: Record<string, AnswerValue> };
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON', message: '请求体必须是合法 JSON。' }, { status: 400 });
  }
  try {
    if (!body.project || body.project.id !== params.id) return NextResponse.json({ error: 'PROJECT_REQUIRED' }, { status: 400 });
    if (!body.project.idea || !String(body.project.idea).trim()) return NextResponse.json({ error: 'IDEA_REQUIRED', message: '请先填写项目描述（idea）。' }, { status: 400 });
    if (!body.project.kind) return NextResponse.json({ error: 'KIND_REQUIRED', message: '缺少项目类型（kind）。' }, { status: 400 });
    const preferred = await resolveAnyEvaluationProvider(body.project.selectedConnectionId);
    if (preferred.status !== 'connected') return NextResponse.json({ error: 'PROVIDER_REQUIRED', message: '请先连接可用的 AI Provider（Codex CLI 或 API Key）。' }, { status: 503 });
    if (preferred.provider === 'anthropic' || preferred.provider === 'gemini') {
      return NextResponse.json({
        error: 'PROVIDER_ADAPTER_NOT_IMPLEMENTED',
        message: `${preferred.provider === 'anthropic' ? 'Anthropic' : 'Gemini'} 已保存连接，但当前分析引擎尚未启用该 Provider 适配器。请暂时使用 Codex CLI、DeepSeek 或 OpenAI-compatible API。`,
      }, { status: 501 });
    }
    const report = preferred.provider === 'openai' && preferred.connection.mode === 'cli'
      ? await analyzeWithCodex(body.project, body.answers || {}, preferred.connection.model)
      : await analyzeWithDeepSeek(body.project, body.answers || {}, { ...preferred.connection, secret: preferred.secret, provider: preferred.provider });
    await saveStoredReport(params.id, report);
    return NextResponse.json({ report, provider: preferred.provider, mode: 'live' });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : 'ANALYSIS_FAILED';
    const message = error instanceof Error ? error.message : '真实 AI 评估失败，请稍后重试。';
    return NextResponse.json({ error: code, message }, { status: code === 'INVALID_API_KEY' ? 401 : 502 });
  }
}
