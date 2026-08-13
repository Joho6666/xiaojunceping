"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp, newJob } from "../../../../components/AppProvider";
import { EvaluationMode, GithubProjectRecommendation } from "../../../../types";
import {
  downloadText,
  reportToMarkdown,
} from "../../../../services/exportService";
import { rerunAnalysis } from "../../../../services/reportService";
import { buildMockReport } from "../../../../data/reportCatalog";
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
  const view = app.reportView || app.project?.evaluationMode || "quick";
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
  // Older persisted reports predate projectIdea. Reattach the current project
  // context so domain filtering remains correct after a refresh or migration.
  const staleTokenEstimate = r.estimates.tokens.display.includes("本次实际");
  const fallbackEstimate = buildMockReport(app.project).estimates.tokens;
  const reportWithContext = {
    ...r,
    projectIdea: r.projectIdea || app.project.idea,
    ecosystem: r.ecosystem || [],
    estimates: {
      ...r.estimates,
      tokens: staleTokenEstimate ? fallbackEstimate : r.estimates.tokens,
    },
  };
  const needsRefresh = !r.projectIdea || staleTokenEstimate;
  const isLiveReport = reportWithContext.sources.some(
    (source) => source.id === "deepseek",
  );
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
                ? "DeepSeek 实时分析"
                : "示例报告，请连接 Provider 后重新分析"}
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
            这份报告包含旧版缓存字段，部分策略、参考项目或 Token
            展示可能过时。点击“重新分析”后将使用当前项目描述、领域工作流和
            GitHub 相关性过滤重新生成。
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
