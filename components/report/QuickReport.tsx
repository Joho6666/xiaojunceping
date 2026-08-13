"use client";
import { ProjectReport } from "../../types";
import { getQuickReport } from "../../services/quickReportService";
import { filterGithubProjects } from "../../services/githubService";

export function QuickReport({
  report,
  onPrompt,
  onExpert,
  onRestart,
}: {
  report: ProjectReport;
  onPrompt: () => void;
  onExpert: () => void;
  onRestart: () => void;
}) {
  const r = getQuickReport(report);
  const githubProjects = filterGithubProjects(
    { kind: report.projectKind, idea: report.projectIdea || "" },
    r.githubProjects,
  );
  return (
    <div className="quick-report-view">
      <section className="quick-hero-block">
        <div>
          <span className="status-chip good">{r.status}</span>
          <h2>{r.title}</h2>
          <p>{r.summary}</p>
          <div className="quick-verdict">
            <span>综合建议</span>
            <strong>{r.verdict}</strong>
          </div>
        </div>
        <div className="quick-score">
          <span>推荐度</span>
          <strong>{report.projectSummary.score}</strong>
          <small>/ 100</small>
        </div>
      </section>
      <section className="quick-recipe card">
        <div>
          <span className="eyebrow">最推荐方案</span>
          <h3>{r.strategy.type}</h3>
          <p>{r.strategy.reason}</p>
        </div>
        <div className="recipe">
          {r.strategy.recipe.map((x, i) => (
            <span key={x}>
              {x}
              {i < r.strategy.recipe.length - 1 && " ＋ "}
            </span>
          ))}
        </div>
      </section>
      <section className="quick-number-grid">
        {[
          ["预计时间", r.estimates.time.display],
          ["Token", r.estimates.tokens.display],
          ["AI / API 成本", r.estimates.cost.display],
          ["人工投入", r.estimates.humanEffort.display],
        ].map(([label, value]) => (
          <div className="quick-number card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>预测置信度：{r.estimates.time.confidence}</small>
          </div>
        ))}
      </section>
      <section className="quick-section">
        <div className="quick-section-head">
          <div>
            <span className="eyebrow">AI 生态匹配</span>
            <h2>可以直接验证的候选能力</h2>
          </div>
          <button className="text-link button-link" onClick={onExpert}>
            查看完整生态清单 →
          </button>
        </div>
        <div className="quick-ai-grid">
          {report.ecosystem.slice(0, 3).map((item) => (
            <div className="card" key={item.id}>
              <span>
                {item.category.toUpperCase()} · {item.source}
              </span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <small>{item.reason}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="quick-section">
        <div className="quick-section-head">
          <div>
            <span className="eyebrow">推荐 AI 配置</span>
            <h2>让合适的 Agent 做合适的事</h2>
          </div>
          <details>
            <summary>为什么这样推荐？</summary>
            <p>{r.primaryAgent.reason}</p>
          </details>
        </div>
        <div className="quick-ai-grid">
          <div className="card">
            <span>开发 Agent</span>
            <h3>{r.primaryAgent.name}</h3>
            <p>{r.primaryAgent.description}</p>
            <small>{r.primaryAgent.reason}</small>
          </div>
          {r.primaryModels.map((model, i) => (
            <div className="card" key={model.id}>
              <span>{i === 0 ? "主力模型" : "专项模型"}</span>
              <h3>{model.name}</h3>
              <p>{model.task}</p>
              <small>{model.reason}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="quick-section">
        <div className="quick-section-head">
          <div>
            <span className="eyebrow">参考项目</span>
            <h2>先看看这些现成项目</h2>
          </div>
          <button className="text-link button-link" onClick={onExpert}>
            查看全部参考项目 →
          </button>
        </div>
        <div className="quick-reference-grid">
          {githubProjects.map((item) => (
            <article className="card" key={item.id}>
              <div className="quick-reference-title">
                <div>
                  <span className="mono tiny">{item.repo}</span>
                  <h3>{item.name}</h3>
                </div>
                <b>{item.similarity}%</b>
              </div>
              <p>{item.description}</p>
              <small>{item.recommendedUse}</small>
              <a
                className="btn"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                查看 GitHub ↗
              </a>
            </article>
          ))}
        </div>
      </section>
      <section className="quick-section">
        <span className="eyebrow">推荐工程计划</span>
        <h2>从验证到上线</h2>
        <div className="quick-plan">
          {r.workflow.map((phase, i) => (
            <div className="quick-plan-row" key={phase.id}>
              <strong>{String(i + 1).padStart(2, "0")}</strong>
              <div>
                <h3>{phase.title}</h3>
                <p>{phase.goal}</p>
              </div>
              <span>{phase.time}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="quick-section">
        <span className="eyebrow">需要特别注意</span>
        <h2>主要风险</h2>
        <div className="quick-risk-list">
          {r.risks.map((risk) => (
            <div className="card" key={risk.title}>
              <span
                className={`status-chip ${risk.level.includes("高") ? "bad" : "warn"}`}
              >
                {risk.level}
              </span>
              <strong>{risk.title}</strong>
              <p>{risk.advice}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="quick-cta card">
        <div>
          <span className="eyebrow">下一步</span>
          <h2>方案已经足够清晰，可以开始执行</h2>
          <p>
            生成一份适合 Coding Agent
            直接使用的执行上下文，或升级查看完整专家分析。
          </p>
        </div>
        <div>
          <button className="btn primary" onClick={onPrompt}>
            生成执行 Prompt
          </button>
          <button className="btn" onClick={onExpert}>
            查看专家分析
          </button>
          <button className="btn" onClick={onRestart}>
            重新评估
          </button>
        </div>
      </section>
    </div>
  );
}
