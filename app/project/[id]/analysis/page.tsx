"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp, newJob } from "../../../../components/AppProvider";
import {
  analysisSteps,
  quickAnalysisSteps,
} from "../../../../services/analysisService";
import { AnalysisJob } from "../../../../types";

const discoveries = {
  video: [
    "找到 3 个视频开源项目",
    "发现 2 个成熟剪辑 SaaS",
    "正在比较多模态视频模型",
  ],
  cad: [
    "找到 3 个参数化 CAD 项目",
    "确认 STEP / STL 交付路线",
    "识别制造校核人工节点",
  ],
  pcb: [
    "找到 KiCad 与 SKiDL 方案",
    "识别 BOM / Gerber 输出",
    "确认 ERC / DRC 验收节点",
  ],
  web: [
    "找到 3 个 SaaS Starter",
    "发现成熟 Auth 与支付方案",
    "正在比较 8 个 Coding Agent",
  ],
  automation: [
    "找到 n8n 与 Activepieces",
    "发现 2 个成熟自动化 SaaS",
    "正在评估 5 套集成路线",
  ],
  general: ["正在搜索相似开源项目", "正在比较实现路线", "正在确认关键约束"],
};
const quickStatuses: AnalysisJob["status"][] = [
  "queued",
  "understanding",
  "researching",
  "matching",
  "matching",
  "estimating",
  "estimating",
  "generating",
];

export default function Analysis() {
  const app = useApp(),
    router = useRouter(),
    params = useParams();
  const [error, setError] = useState("");
  const [providerLabel, setProviderLabel] = useState("已连接的 AI Provider");
  const [modelLabel, setModelLabel] = useState("按已连接配置执行");
  const [discovery, setDiscovery] = useState<{ github: number; ecosystem: number; categories: string[]; browser: number; browserError?: string; queries: string[] } | null>(null);
  const mode = app.project?.evaluationMode || "expert";
  const steps = mode === "quick" ? quickAnalysisSteps : analysisSteps;
  useEffect(() => {
    fetch("/api/connections")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const connections = data?.connections || [];
        const selected = connections.find((item: { id?: string; provider?: string; mode?: string; status?: string }) => item.id === app.project?.selectedConnectionId && item.status === "connected") || connections.find((item: { provider?: string; mode?: string; status?: string }) => item.provider === "openai" && item.mode === "cli" && item.status === "connected") || connections.find((item: { status?: string }) => item.status === "connected");
        if (selected) {
          setProviderLabel(selected.provider === "openai" ? "Codex CLI" : selected.displayName || selected.provider);
          setModelLabel(selected.model || "Provider 默认模型");
        }
      })
      .catch(() => undefined);
  }, [app.project?.selectedConnectionId]);
  useEffect(() => {
    if (!app.hydrated || !app.project) return;
    let cancelled = false;
    let job =
      app.analysisJob?.status === "completed"
        ? newJob(mode)
        : app.analysisJob || newJob(mode);
    if (!app.analysisJob || app.analysisJob.status === "completed")
      app.setAnalysisJob(job);
    const timer = setInterval(
      async () => {
        if (cancelled) return;
        const next = job.stepIndex + 1;
        if (next >= steps.length) {
          clearInterval(timer);
          const project = app.project;
          if (!project) return;
          app.setAnalysisJob({
            ...job,
            status: "generating",
            progress: 92,
            currentStep: "正在检索 GitHub、Skill、MCP、Plugin 与参考项目",
            stepIndex: job.stepIndex,
          });
          try {
            const discoveryResponse = await fetch(`/api/projects/${project.id}/discover`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project, answers: app.answers }),
            });
            if (discoveryResponse.ok) {
              const found = await discoveryResponse.json() as { githubProjects?: unknown[]; ecosystem?: Array<{ category?: string }>; knowledge?: { browserSearch?: { resultCount?: number; error?: string; queries?: string[] } } };
              setDiscovery({
                github: found.githubProjects?.length || 0,
                ecosystem: found.ecosystem?.length || 0,
                categories: Array.from(new Set((found.ecosystem || []).map((item) => item.category).filter(Boolean))) as string[],
                browser: found.knowledge?.browserSearch?.resultCount || 0,
                browserError: found.knowledge?.browserSearch?.error,
                queries: found.knowledge?.browserSearch?.queries || [],
              });
            }
          } catch {
            // The analysis API performs the same fallback discovery before generating the report.
          }
          try {
            const response = await fetch(`/api/projects/${project.id}/analyze`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ project, answers: app.answers }),
            });
            const contentType = response.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
              ? (await response.json()) as { report?: typeof app.report; message?: string; error?: string }
              : { message: `服务返回了非 JSON 响应（HTTP ${response.status}），请检查本地服务日志。` };
            if (!response.ok || !data.report) {
              clearInterval(timer);
              app.setAnalysisJob({
                ...job,
                status: "failed",
                progress: 92,
                currentStep: "分析失败",
                stepIndex: job.stepIndex,
              });
              setError(
                data.message || data.error || "真实 AI 评估失败，请检查当前 AI Provider 连接。",
              );
              return;
            }
            if (cancelled) return;
            app.setReport(data.report);
            app.setAnalysisJob({
              ...job,
              status: "completed",
              progress: 100,
              currentStep: "分析完成",
              stepIndex: steps.length,
            });
            setTimeout(() => {
              if (!cancelled) router.push(`/project/${params.id}/report`);
            }, 350);
          } catch (requestError) {
            if (cancelled) return;
            app.setAnalysisJob({
              ...job,
              status: "failed",
              progress: 92,
              currentStep: "分析失败",
              stepIndex: job.stepIndex,
            });
            setError(requestError instanceof Error ? requestError.message : "分析请求失败，请检查本地服务是否仍在运行。");
          }
          return;
        }
        const status: AnalysisJob["status"] =
          mode === "quick"
            ? quickStatuses[next] || "generating"
            : next < 3
              ? "researching"
              : next < 7
                ? "matching"
                : next < 9
                  ? "estimating"
                  : "generating";
        job = {
          ...job,
          mode,
          status,
          stepIndex: next,
          currentStep: steps[next],
          progress: Math.round((next / (steps.length - 1)) * 100),
        };
        app.setAnalysisJob(job);
      },
      mode === "quick" ? 650 : 430,
    );
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // The interval intentionally captures one immutable analysis run. Adding
    // the mutable context object here would restart the API pipeline on every
    // progress update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.hydrated, app.project?.id, mode]);
  if (!app.hydrated) return <div className="content">正在恢复分析任务…</div>;
  if (app.project && String(params.id) !== app.project.id)
    return (
      <div className="content">
        <h1>项目状态不匹配</h1>
        <p>请从首页重新打开当前项目。</p>
        <button className="btn primary" onClick={() => router.push("/")}>
          返回首页
        </button>
      </div>
    );
  if (!app.project) return <div className="content">未找到项目。</div>;
  const job = app.analysisJob || newJob(mode),
    notes = discoveries[app.project.kind] || discoveries.general;
  return (
    <main>
      <div className="analysis-layout">
        <aside className="sidebar">
          <p className="sidebar-title">
            {mode === "quick" ? "快速评估" : "项目技术研究"}
          </p>
          <div className="sidebar-item">
            ✓ {mode === "quick" ? "理解项目" : "需求理解"}
          </div>
          <div className="sidebar-item active">
            ◉ {mode === "quick" ? "匹配方案" : "技术研究"}
          </div>
          <div className="sidebar-item">
            ○ {mode === "quick" ? "生成执行计划" : "决策报告"}
          </div>
        </aside>
        <section className="content">
          <div className="analysis-bg">
            <div className="eyebrow">
              小君AI测评 {mode === "quick" ? "快速评估" : "项目分析"}
            </div>
            <h1>
              {error
                ? "真实评估未完成"
                : mode === "quick"
                  ? "正在生成你的快速方案"
                  : "正在研究你的项目"}
            </h1>
            <p className="muted">
              {error ||
                (mode === "quick"
                  ? `正在调用 ${providerLabel}、GitHub 搜索并估算最小可行工程计划。`
                  : `正在调用 ${providerLabel} 比较现有方案、工具能力、Agent、模型与执行路线。`)}
            </p>
            {error && (
              <>
                <button
                  className="btn primary"
                  onClick={() => router.push("/settings/ai")}
                >
                  去配置 AI Provider
                </button>
                <button className="btn" onClick={() => location.reload()}>
                  重新评估
                </button>
              </>
            )}
            <div className="analysis-grid">
              <div className="card analysis-steps">
                <div className="progress-label">
                  <h3>分析进度</h3>
                  <span>{job.progress}%</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${job.progress}%` }} />
                </div>
                {steps.map((step, i) => (
                  <div
                    className={`analysis-step ${i < job.stepIndex ? "done" : ""} ${i === job.stepIndex ? "active" : ""}`}
                    key={step}
                  >
                    <span className="step-icon">
                      {i < job.stepIndex ? "✓" : i === job.stepIndex ? "◉" : ""}
                    </span>
                    {step}
                  </div>
                ))}
              </div>
              <div>
                {discovery ? (
                  <>
                    <div className="card analysis-note fade-in">
                      <h3>已找到</h3>
                      <p>{discovery.github} 个 GitHub 项目 · {discovery.ecosystem} 个生态候选</p>
                    </div>
                    <div className="card analysis-note fade-in">
                      <h3>正在匹配</h3>
                      <p>{discovery.categories.length ? discovery.categories.join("、") : "Skill、MCP、Plugin 与 Agent"}</p>
                    </div>
                    <div className="card analysis-note fade-in">
                      <h3>浏览器搜索</h3>
                      <p>{discovery.browser ? `已检索 ${discovery.browser} 条网页结果` : discovery.browserError || "未配置或未执行浏览器搜索"}</p>
                      {discovery.queries.length > 0 && <small className="muted">查询：{discovery.queries.slice(0, 2).join("；")}</small>}
                    </div>
                  </>
                ) : notes.slice(0, mode === "quick" ? 2 : 3).map((note, i) => (
                  <div className="card analysis-note fade-in" key={note}>
                    <h3>{i === 0 ? "已找到" : "正在比较"}</h3>
                    <p>{note}</p>
                  </div>
                ))}
                <div className="card analysis-note">
                  <h3>当前任务</h3>
                  <strong>{job.currentStep}</strong>
                  <p className="muted">
                    {discovery ? "已完成候选检索，正在把来源、匹配理由和限制写入报告。" : "将依次检索知识库、GitHub、Skill、MCP、Plugin 和参考项目；没有连接时不会生成假报告。"}
                  </p>
                </div>
                <div className="card analysis-note">
                  <h3>项目实施预测</h3>
                  <strong>Token：约 2 万–8 万</strong>
                  <p>时间：约 3–7 天 · 执行模型：{modelLabel}</p>
                  <small className="muted">这是项目实施预测，不是本次测评 API 消耗；最终以报告中的范围和置信度为准。</small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
