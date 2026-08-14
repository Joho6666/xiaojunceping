'use client';
import { useMemo, useState } from 'react';
import { Project, ProjectReport } from '../../types';
import { buildAgentPlan, buildPromptArtifacts } from '../../services/reportCustomizationService';

export function PromptModal({ project, report, onClose }: { project: Project; report: ProjectReport; onClose: () => void }) {
  const [agent, setAgent] = useState('Codex');
  const [artifactType, setArtifactType] = useState<'master' | 'agents-md' | 'agent'>('master');
  const [status, setStatus] = useState('');
  const plan = report.agentPlan || buildAgentPlan(project, { projectKind: project.kind, domain: [], goals: [project.idea], capabilities: [], tags: [], stack: [], platforms: [], constraints: [], dataSensitivity: '未知', needsLiveSearch: true }, report, report.model || project.selectedModel || '按已选模型');
  const artifacts = report.promptArtifacts?.length ? report.promptArtifacts : buildPromptArtifacts(project, report, plan);
  const selected = useMemo(() => {
    if (artifactType === 'agents-md') return artifacts.find((item) => item.type === 'agents-md') || artifacts[0];
    if (artifactType === 'agent') return artifacts.find((item) => item.type === 'agent') || artifacts[0];
    return artifacts.find((item) => item.type === 'master') || artifacts[0];
  }, [artifactType, artifacts]);
  const content = artifactType === 'master' ? `${selected?.content || ''}\n\n## 执行工具模板\n${agent}` : selected?.content || '';
  const copy = async () => { try { await navigator.clipboard.writeText(content); setStatus('✓ 已复制'); } catch { setStatus('复制失败，请手动选择文本'); } setTimeout(() => setStatus(''), 1800); };
  const download = () => { const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = selected?.name || 'AGENTS.md'; link.click(); URL.revokeObjectURL(url); };
  return <div className="modal-backdrop" onClick={onClose}><div className="modal wide" onClick={e => e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">{project.evaluationMode === 'quick' ? '快速' : '专家'}执行方案生成器</div><h2>生成项目专属 Prompt</h2></div><button className="btn" onClick={onClose}>×</button></div><div className="agent-select">{['Codex', 'Claude Code', 'Cursor', 'OpenCode'].map(x => <button className={agent === x ? 'active' : ''} key={x} onClick={() => setAgent(x)}>{x}</button>)}</div><div className="agent-select"><button className={artifactType === 'master' ? 'active' : ''} onClick={() => setArtifactType('master')}>Master Prompt</button><button className={artifactType === 'agent' ? 'active' : ''} onClick={() => setArtifactType('agent')}>单个 Agent Prompt</button><button className={artifactType === 'agents-md' ? 'active' : ''} onClick={() => setArtifactType('agents-md')}>AGENTS.md</button></div><p className="muted">当前项目：{project.idea} · Agent 顺序：{plan.agents.map(item => item.name).join(' → ')}</p><div className="prompt-preview">{content}</div><div className="bottom-actions"><span className="muted">{status}</span><button className="btn" onClick={download}>下载 Markdown</button><button className="btn primary" onClick={copy}>复制 Prompt</button></div></div></div>;
}
