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
  "estimating",
  "generating",
];

export default function Analysis() {
  const app = useApp(),
    router = useRouter(),
    params = useParams();
  const [error, setError] = useState("");
  const mode = app.project?.evaluationMode || "expert";
  const steps = mode === "quick" ? quickAnalysisSteps : analysisSteps;
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
            currentStep: "正在调用 DeepSeek 与 GitHub",
            stepIndex: job.stepIndex,
          });
          const response = await fetch(`/api/projects/${project.id}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project, answers: app.answers }),
          });
          const data = (await response.json()) as {
            report?: typeof app.report;
            error?: string;
            message?: string;
          };
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
              data.message || "真实 AI 评估失败，请检查 DeepSeek 连接。",
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
          return;
        }
        const status: AnalysisJob["status"] =
          mode === "quick"
            ? quickStatuses[next] || "generating"
            : next < 6
              ? "researching"
              : next < 10
                ? "matching"
                : next < 13
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
    notes = discoveries[app.project.kind];
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
              AgentScope {mode === "quick" ? "快速评估" : "项目分析"}
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
                  ? "正在调用 DeepSeek、GitHub 搜索并估算最小可行工程计划。"
                  : "正在调用 DeepSeek 比较现有方案、工具能力、Agent、模型与执行路线。")}
            </p>
            {error && (
              <>
                <button
                  className="btn primary"
                  onClick={() => router.push("/settings/ai")}
                >
                  去配置 DeepSeek
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
                {notes.slice(0, mode === "quick" ? 2 : 3).map((note, i) => (
                  <div className="card analysis-note fade-in" key={note}>
                    <h3>{i === 0 ? "已找到" : "正在比较"}</h3>
                    <p>{note}</p>
                  </div>
                ))}
                <div className="card analysis-note">
                  <h3>当前任务</h3>
                  <strong>{job.currentStep}</strong>
                  <p className="muted">
                    当前使用已连接的 DeepSeek 与 GitHub
                    公共搜索；没有连接时不会生成假报告。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
