import { NextRequest, NextResponse } from 'next/server';
import { resolveProvider } from '../../../../../services/providerService';
import { analyzeWithDeepSeek } from '../../../../../services/realAnalysisService';
import { saveReport } from '../../../../../services/reportService';
import { Project, AnswerValue } from '../../../../../types';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { project?: Project; answers?: Record<string, AnswerValue> };
    if (!body.project || body.project.id !== params.id) return NextResponse.json({ error: 'PROJECT_REQUIRED' }, { status: 400 });
    const provider = resolveProvider('deepseek');
    if (provider.status !== 'connected' || !provider.secret) return NextResponse.json({ error: 'PROVIDER_REQUIRED', message: '请先在 AI 配置中连接 DeepSeek。' }, { status: 503 });
    const report = await analyzeWithDeepSeek(body.project, body.answers || {}, { ...provider.connection, secret: provider.secret });
    await saveReport(params.id, report);
    return NextResponse.json({ report, provider: 'deepseek', mode: 'live' });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : 'ANALYSIS_FAILED';
    const message = error instanceof Error ? error.message : '真实 AI 评估失败，请稍后重试。';
    return NextResponse.json({ error: code, message }, { status: code === 'INVALID_API_KEY' ? 401 : 502 });
  }
}
