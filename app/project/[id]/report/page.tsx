"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp, newJob } from "../../../../components/AppProvider";
import { EvaluationMode, GithubProjectRecommendation, ProjectReport } from "../../../../types";
import {
  downloadText,
  reportToMarkdown,
} from "../../../../services/exportService";
import { rerunAnalysis } from "../../../../services/reportService";
import { buildInputFingerprint } from "../../../../services/reportCustomizationService";
import { PromptModal } from "../../../../components/report/PromptModal";
import { QuickReport } from "../../../../components/report/QuickReport";
import {
  sections,
  Conclusion,
  Strategy,
  Github,
  Products,
  Agents,
  Models,
  Tools,
  Ecosystem,
  Interfaces,
  Stack,
  Workflow,
  Architecture,
  Estimates,
  Automation,
  Risks,
  ConfidenceBlock,
  Sources,
  ModelCompare,
  GithubDrawer,
} from "../../../../components/report/ReportSections";
export default function ReportPage() {
  const app = useApp(),
    router = useRouter(),
    params = useParams();
  const [active, setActive] = useState("conclusion");
  const [prompt, setPrompt] = useState(false),
    [compare, setCompare] = useState(false),
    [drawer, setDrawer] = useState<GithubProjectRecommendation | null>(null),
    [toast, setToast] = useState("");
  const discoveryRef = useRef("");
  const view = app.reportView || app.project?.evaluationMode || "quick";
  useEffect(() => {
    if (!app.hydrated || app.report || !app.project || String(params.id) !== app.project.id) return;
    fetch(`/api/projects/${params.id}/report`).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { report?: ProjectReport };
      if (data.report) app.setReport(data.report);
    }).catch(() => undefined);
  }, [app, params.id]);
  useEffect(() => {
    if (!app.hydrated || !app.report || !app.project || String(params.id) !== app.project.id) return;
    const key = `${app.project.id}:${app.report.generatedAt}`;
    const ecosystemCategories = new Set<string>((app.report.ecosystem || []).map((item) => item.category));
    const hasGithubEvidence = (app.report.sources || []).some((source) => source.id === "github-live" || source.id === "github-codex-search");
    const needsDiscovery = !(app.report.githubProjects || []).length || !(app.report.ecosystem || []).length || !hasGithubEvidence || !["skill", "mcp", "plugin"].every((category) => ecosystemCategories.has(category));
    if (!needsDiscovery || discoveryRef.current === key) return;
    discoveryRef.current = key;
    fetch(`/api/projects/${params.id}/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: app.project, answers: app.answers }),
    }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as Pick<ProjectReport, "githubProjects" | "ecosystem" | "knowledge" | "sources">;
      app.setReport({ ...app.report!, ...data });
    }).catch(() => undefined);
  }, [app, params.id]);
  useEffect(() => {
    if (!app.report || view === "quick") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((x) => x.isIntersecting)
          .forEach((x) => setActive(x.target.id));
      },
      { rootMargin: "-20% 0px -65%" },
    );
    sections.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [app.report, view]);
  if (!app.hydrated) return <div className="content">正在恢复报告…</div>;
  if (app.project && String(params.id) !== app.project.id)
    return (
      <div className="content empty-state">
        <h1>项目状态不匹配</h1>
        <p>当前浏览器保存的是另一个项目，请从首页重新打开正确的项目。</p>
        <button className="btn primary" onClick={() => router.push("/")}>
          返回首页
        </button>
      </div>
    );
  if (!app.project || !app.report)
    return (
      <div className="content empty-state">
        <h1>报告尚未生成</h1>
        <p>请先完成需求访谈和项目分析。</p>
        <button className="btn primary" onClick={() => router.push("/")}>
          返回首页
        </button>
      </div>
    );
  const r = app.report;
  const reportArraysValid = Array.isArray(r.scores) && Array.isArray(r.agents) && Array.isArray(r.models) && Array.isArray(r.githubProjects) && Array.isArray(r.referenceProducts) && Array.isArray(r.tools) && Array.isArray(r.ecosystem) && Array.isArray(r.interfaces) && Array.isArray(r.techStack) && Array.isArray(r.workflows) && Array.isArray(r.alternatives) && Array.isArray(r.architecture) && Array.isArray(r.risks) && Array.isArray(r.sources);
  if (!reportArraysValid || !r.estimates?.tokens || !r.estimates?.time || !r.estimates?.cost || !r.estimates?.automation || !r.projectSummary || !r.strategy || !r.confidence || !r.generationMode || r.generationMode === "mock") {
    return (
      <div className="content empty-state">
        <h1>这份报告需要重新生成</h1>
        <p>当前保存的是示例报告、旧版本报告或结构不完整结果。为避免把固定内容误当成当前项目结论，系统没有继续渲染它。</p>
        <button className="btn primary" onClick={async () => { await rerunAnalysis(app.project!.id); app.setReport(null); app.setAnalysisJob(newJob(view)); router.push(`/project/${params.id}/analysis`); }}>
          重新分析
        </button>
      </div>
    );
  }
  // Older persisted reports predate projectIdea. Reattach the current project
  // context so domain filtering remains correct after a refresh or migration.
  const staleTokenEstimate = r.estimates.tokens.display.includes("本次实际");
  const reportWithContext = {
    ...r,
    projectIdea: r.projectIdea || app.project.idea,
    ecosystem: r.ecosystem || [],
    estimates: {
      ...r.estimates,
      tokens: r.estimates.tokens,
    },
  };
  const currentFingerprint = buildInputFingerprint(app.project, app.answers, "knowledge-v1", "knowledge-base+github");
  const needsRefresh = !r.projectIdea || staleTokenEstimate || (Boolean(r.inputFingerprint) && r.inputFingerprint !== currentFingerprint);
  const isLiveReport = reportWithContext.generationMode === "live";
  const message = (x: string) => {
    setToast(x);
    setTimeout(() => setToast(""), 1800);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(r));
      message("✓ 报告已复制");
    } catch {
      message("复制失败，请重试");
    }
  };
  const reanalyze = async () => {
    await rerunAnalysis(app.project!.id);
    app.setReport(null);
    app.setAnalysisJob(newJob(view));
    router.push(`/project/${params.id}/analysis`);
  };
  const openExpert = () => {
    app.setEvaluationMode("expert");
    app.setReportView("expert");
    app.setUpgradePending(false);
    message("已保留项目上下文，正在切换专家报告");
  };
  const switchView = (next: EvaluationMode) => app.setReportView(next);
  return (
    <main>
      <div className="report-shell">
        <header className="report-header report-header-wide">
          <div>
            <div className="eyebrow">项目评估报告</div>
            <h1>{r.projectSummary.title}</h1>
            <p className="muted">
              分析时间：{new Date(r.generatedAt).toLocaleString("zh-CN")} ·
              {isLiveReport
                ? `${r.provider || "已连接 Provider"} / ${r.model || "已选模型"} 实时分析`
                : r.generationMode === "knowledge-only" ? "知识库规则分析" : "示例报告，需要重新分析"}
            </p>
          </div>
          <div className="report-actions">
            <div className="report-tabs">
              <button
                className={view === "quick" ? "active" : ""}
                onClick={() => switchView("quick")}
              >
                快速报告
              </button>
              <button
                className={view === "expert" ? "active" : ""}
                onClick={() => switchView("expert")}
              >
                专家报告
              </button>
            </div>
            <button className="btn" onClick={reanalyze}>
              重新分析
            </button>
            <details className="export-menu">
              <summary className="btn">导出</summary>
              <div>
                <button onClick={copy}>复制报告</button>
                <button
                  onClick={() =>
                    downloadText(
                      `${r.projectSummary.title}.json`,
                      JSON.stringify(r, null, 2),
                      "application/json",
                    )
                  }
                >
                  导出 JSON
                </button>
                <button
                  onClick={() =>
                    downloadText(
                      `${r.projectSummary.title}.md`,
                      reportToMarkdown(r),
                      "text/markdown",
                    )
                  }
                >
                  导出 Markdown
                </button>
                <button disabled>PDF · 即将支持</button>
              </div>
            </details>
            <button className="btn primary" onClick={() => setPrompt(true)}>
              生成执行 Prompt
            </button>
          </div>
        </header>
        {needsRefresh && (
          <div className="report-notice" role="status">
            这份报告不是当前输入对应的实时结果，或来自旧版缓存。点击“重新分析”后，系统会重新读取当前项目、所选模型、知识库和联网搜索结果；真实分析失败时不会用示例报告替代。
          </div>
        )}
        {view === "quick" ? (
          <QuickReport
            report={reportWithContext}
            onPrompt={() => setPrompt(true)}
            onExpert={openExpert}
            onRestart={() => router.push(`/project/${params.id}/interview`)}
          />
        ) : (
          <div className="report-layout full-report">
            <aside className="report-nav">
              <div className="nav-meta">
                <span className="eyebrow">报告目录</span>
                <strong>{r.projectSummary.typeLabel}</strong>
                <small>
                  {r.projectSummary.score}/100 · {r.projectSummary.status}
                </small>
              </div>
              {sections.map(([id, label]) => (
                <a
                  className={active === id ? "active" : ""}
                  href={`#${id}`}
                  key={id}
                >
                  {label}
                </a>
              ))}
            </aside>
            <section className="report-content">
              <div className="mobile-report-nav">
                {sections.map(([id, label]) => (
                  <a href={`#${id}`} key={id}>
                    {label}
                  </a>
                ))}
              </div>
              <Conclusion r={reportWithContext} />
              <Strategy r={reportWithContext} />
              <Github r={reportWithContext} onOpen={setDrawer} />
              <Products r={reportWithContext} />
              <Agents r={reportWithContext} />
              <Models
                r={reportWithContext}
                onCompare={() => setCompare(true)}
              />
              <Tools r={reportWithContext} />
              <Ecosystem r={reportWithContext} />
              <Interfaces r={reportWithContext} />
              <Stack r={reportWithContext} />
              <Workflow r={reportWithContext} />
              <Architecture r={reportWithContext} />
              <Estimates r={reportWithContext} />
              <Automation r={reportWithContext} />
              <Risks r={reportWithContext} />
              <ConfidenceBlock r={reportWithContext} />
              <Sources r={reportWithContext} />
              <div className="report-cta">
                <div>
                  <h2>项目方案已经准备好了</h2>
                  <p>生成可直接交给 Coding Agent 的执行上下文。</p>
                </div>
                <button className="btn primary" onClick={() => setPrompt(true)}>
                  生成项目执行 Prompt
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
      {prompt && (
        <PromptModal
          project={app.project}
          report={reportWithContext}
          onClose={() => setPrompt(false)}
        />
      )}{" "}
      {compare && (
        <ModelCompare models={r.models} onClose={() => setCompare(false)} />
      )}{" "}
      {drawer && <GithubDrawer item={drawer} onClose={() => setDrawer(null)} />}
    </main>
  );
}
