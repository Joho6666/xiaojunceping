"use client";
import { useState } from "react";
import {
  GithubProjectRecommendation,
  ModelRecommendation,
  ProjectReport,
} from "../../types";
import { filterGithubProjects } from "../../services/githubService";
export const sections = [
  ["conclusion", "项目结论"],
  ["strategy", "实现策略"],
  ["github", "参考项目"],
  ["products", "类似产品"],
  ["agents", "Agent"],
  ["models", "模型"],
  ["tools", "开发工具"],
  ["ecosystem", "AI 生态匹配"],
  ["interfaces", "接口能力"],
  ["stack", "技术栈"],
  ["workflow", "工作流"],
  ["architecture", "执行架构"],
  ["estimates", "时间与 Token"],
  ["automation", "自动化"],
  ["risks", "风险"],
  ["confidence", "置信度"],
  ["sources", "来源"],
] as const;
export function Conclusion({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="conclusion" title="项目结论" lead>
      <div className="report-conclusion">
        <div>
          <span className="status-chip good">{r.projectSummary.status}</span>
          <h2>{r.projectSummary.verdict}</h2>
          <p>{r.projectSummary.summary}</p>
        </div>
        <div className="decision-score">
          <strong>{r.projectSummary.score}</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div className="metric-grid">
        {r.scores.map((x) => (
          <div className="metric card" key={x.label}>
            <label>{x.label}</label>
            <strong>{x.score}</strong>
            <div className="progress">
              <span style={{ width: `${x.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
export function Strategy({ r }: { r: ProjectReport }) {
  const [s, setS] = useState(0);
  return (
    <ReportSection id="strategy" title="推荐实现策略" lead>
      <div className="strategy-hero">
        <div>
          <span className="eyebrow">推荐方案 · {r.strategy.confidence}%</span>
          <h2>{r.strategy.type}</h2>
          <p>{r.strategy.reason}</p>
          <div className="recipe">
            {r.strategy.recipe.map((x, i) => (
              <span key={x}>
                {x}
                {i < r.strategy.recipe.length - 1 && " ＋ "}
              </span>
            ))}
          </div>
        </div>
        <div className="saving">
          <span>预计节省</span>
          <strong>{r.strategy.savings.time} 时间</strong>
          <strong>{r.strategy.savings.tokens} Token</strong>
        </div>
      </div>
      <h3>其他可选方案</h3>
      <div className="alternative-tabs">
        {r.alternatives.map((x, i) => (
          <button
            className={s === i ? "active" : ""}
            onClick={() => setS(i)}
            key={x.name}
          >
            {x.name}
            {x.recommended && " · 推荐"}
          </button>
        ))}
      </div>
      <div className="alternative-detail">
        {(() => {
          // Older persisted reports may have an empty alternatives array while
          // the tab index stays at 0; index access then yields undefined.
          const alt = r.alternatives[s] ?? r.alternatives[0];
          if (!alt) return null;
          return (
            <>
              <strong>{alt.strategy}</strong>
              <p>{alt.description}</p>
              <div className="fact-row">
                <span>时间 {alt.time}</span>
                <span>Token {alt.tokens}</span>
                <span>成本 {alt.cost}</span>
                <span>风险 {alt.risk}</span>
                <span>自由度 {alt.freedom}</span>
              </div>
            </>
          );
        })()}
      </div>
    </ReportSection>
  );
}
export function Github({
  r,
  onOpen,
}: {
  r: ProjectReport;
  onOpen: (x: GithubProjectRecommendation) => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const githubSource = r.sources.find((x) => x.id === "github-live" || x.id === "github-codex-search");
  const live = githubSource?.type === "GitHub API" || githubSource?.type === "GitHub API + Codex 搜索意图";
  const projects = filterGithubProjects(
    { kind: r.projectKind, idea: r.projectIdea || "" },
    r.githubProjects,
  );
  return (
    <ReportSection
      id="github"
      title="GitHub 开源项目参考"
      subtitle={
        live
          ? "已通过 GitHub API 校验，展示真实仓库、更新时间和当前 Star。"
          : "当前使用本地知识库快照；重新分析时会先由模型生成搜索意图，再查询并校验 GitHub。"
      }
      collapsible
    >
      {projects.length === 0 ? (
        <div className="empty-state-card">
          <strong>暂未找到与该项目直接相关的仓库</strong>
          <p>
            已过滤掉低相关结果。点击“重新分析”后，将按项目描述重新查询并校验
            GitHub。
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {projects.map((x) => (
            <article className="reference-card" key={x.id}>
              <header>
                <div>
                  <span className="mono tiny">{x.repo}</span>
                  <h3>{x.name}</h3>
                </div>
                <div>
                  <b className="similarity">{x.similarity}%</b>
                  <span className="source-badge">
                    {x.source === "live" ? "实时仓库" : "示例快照"}
                  </span>
                </div>
              </header>
              <p>{x.description}</p>
              <div className="tag-row">
                {x.stack.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <dl>
                <div>
                  <dt>Star</dt>
                  <dd>{x.stars}</dd>
                </div>
                <div>
                  <dt>语言</dt>
                  <dd>{x.language}</dd>
                </div>
                <div>
                  <dt>License</dt>
                  <dd>{x.license}</dd>
                </div>
                <div>
                  <dt>用途</dt>
                  <dd>{x.recommendedUse}</dd>
                </div>
              </dl>
              <footer>
                <a
                  className="btn"
                  href={x.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看 GitHub ↗
                </a>
                <button className="btn" onClick={() => onOpen(x)}>
                  查看详情
                </button>
                <button
                  className="btn"
                  onClick={() =>
                    setAdded((a) => (a.includes(x.id) ? a : [...a, x.id]))
                  }
                >
                  {added.includes(x.id) ? "✓ 已加入" : "加入方案"}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </ReportSection>
  );
}
export function Products({ r }: { r: ProjectReport }) {
  return (
    <ReportSection
      id="products"
      title="类似产品与竞品"
      subtitle="用于判断市场成熟度和产品体验边界，不构成购买建议。"
      collapsible
    >
      <div className="card-grid">
        {r.referenceProducts.map((x) => (
          <article className="reference-card" key={x.name}>
            <header>
              <div>
                <span className="mono tiny">{x.type}</span>
                <h3>{x.name}</h3>
              </div>
              <b className="similarity">{x.similarity}%</b>
            </header>
            <p>{x.capabilities.join("、")}</p>
            <div className="compare-cols">
              <div>
                <b>值得借鉴</b>
                <p>{x.learnFrom.join("、")}</p>
              </div>
              <div>
                <b>不建议照搬</b>
                <p>{x.avoid.join("、")}</p>
              </div>
            </div>
            <a
              href={x.url}
              target="_blank"
              rel="noreferrer"
              className="text-link"
            >
              打开产品网站 ↗
            </a>
          </article>
        ))}
      </div>
    </ReportSection>
  );
}
export function Agents({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="agents" title="Agent 推荐" lead>
      <div className="card-grid">
        {r.agents.map((x) => (
          <article className="agent-card" key={x.id}>
            <div className="match-ring">{x.matchScore}%</div>
            <span className="mono tiny">
              {x.provider} · {x.role}
            </span>
            <h3>{x.name}</h3>
            <p>{x.description}</p>
            <div className="tag-row">
              {x.capabilities.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <details>
              <summary>为什么推荐？</summary>
              <p>{x.reason}</p>
            </details>
          </article>
        ))}
      </div>
    </ReportSection>
  );
}
export function Models({
  r,
  onCompare,
}: {
  r: ProjectReport;
  onCompare: () => void;
}) {
  return (
    <ReportSection
      id="models"
      title="推荐大模型"
      lead
      action={
        <button className="btn" onClick={onCompare}>
          比较模型
        </button>
      }
    >
      <div className="model-list">
        {r.models.map((x) => (
          <article className="model-card" key={x.id}>
            <header>
              <div>
                <span className="mono tiny">
                  {x.provider} · {x.modelId}
                </span>
                <h3>{x.name}</h3>
                <p>{x.task}</p>
              </div>
              <b className="similarity">{x.matchScore}%</b>
            </header>
            <div className="rating-grid">
              {Object.entries(x.ratings).map(([k, v]) => (
                <span key={k}>
                  {ratingLabel(k)}{" "}
                  <b>
                    {"★".repeat(Math.max(0, Math.min(5, Math.round(v))))}
                    {"☆".repeat(Math.max(0, 5 - Math.min(5, Math.round(v))))}
                  </b>
                </span>
              ))}
            </div>
            <p>
              <b>为什么推荐：</b>
              {x.reason}
            </p>
            <p className="muted">
              <b>不适合：</b>
              {x.weaknesses.join("；")}
            </p>
          </article>
        ))}
      </div>
    </ReportSection>
  );
}
const ratingLabel = (x: string) =>
  ({
    reasoning: "推理",
    coding: "编码",
    vision: "视觉",
    video: "视频",
    speed: "速度",
  })[x] || x;
export function Tools({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="tools" title="推荐工具">
      <div className="tool-grid">
        {r.tools.map((x) => (
          <div className="tool-card" key={x.name}>
            <span className="mono tiny">{x.category}</span>
            <h3>
              {x.name} {x.required && <i>必需</i>}
            </h3>
            <p>{x.purpose}</p>
            <small>{x.reason}</small>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
export function Ecosystem({ r }: { r: ProjectReport }) {
  const labels = {
    "ai-tool": "AI 工具",
    agent: "Agent",
    llm: "LLM",
    skill: "Skill",
    mcp: "MCP",
    plugin: "Plugin",
  };
  return (
    <ReportSection
      id="ecosystem"
      title="AI 生态匹配"
      subtitle="候选来自官方页面、GitHub、Registry 或本地工作流；匹配建议不等同于已安装或已授权。"
      collapsible
    >
      <div className="card-grid">
        {r.ecosystem.map((item) => (
          <article className="reference-card" key={item.id}>
            <header>
              <div>
                <span className="mono tiny">{labels[item.category]}</span>
                <h3>{item.name}</h3>
              </div>
              <b className="similarity">{item.matchScore}%</b>
            </header>
            <p>{item.description}</p>
            <div className="tag-row">
              {item.capabilities.map((capability) => (
                <span key={capability}>{capability}</span>
              ))}
              <span className="source-badge">
                {item.source} · {item.updatedAt}
              </span>
            </div>
            <p>
              <strong>为什么匹配：</strong>
              {item.reason}
            </p>
            <p>
              <strong>接入方式：</strong>
              {item.access}
            </p>
            {item.pricing && (
              <p>
                <strong>成本：</strong>
                {item.pricing}
              </p>
            )}
            {item.url && (
              <a
                className="text-link"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                查看来源 ↗
              </a>
            )}
          </article>
        ))}
      </div>
    </ReportSection>
  );
}
export function Interfaces({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="interfaces" title="可用接口与自动化能力" collapsible>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>目标</th>
              <th>API</th>
              <th>CLI</th>
              <th>MCP</th>
              <th>SDK</th>
              <th>Computer Use</th>
            </tr>
          </thead>
          <tbody>
            {r.interfaces.map((x) => (
              <tr key={x.target}>
                <td>
                  <b>{x.target}</b>
                  <small>{x.note}</small>
                </td>
                {(["api", "cli", "mcp", "sdk", "computerUse"] as const).map(
                  (k) => (
                    <td key={k}>
                      <Status value={x[k]} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportSection>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span
      className={`capability ${value === "推荐" ? "good" : value === "有限制" ? "warn" : "bad"}`}
    >
      {value === "推荐" ? "●" : value === "有限制" ? "▲" : "×"} {value}
    </span>
  );
}
export function Stack({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="stack" title="推荐技术栈">
      <div className="stack-list">
        {r.techStack.map((x, i) => (
          <div className="stack-row" key={`${x.layer}-${x.name}-${i}`}>
            <span className="mono tiny">{x.layer}</span>
            <div>
              <h3>
                {x.name} <b>{x.matchScore}%</b>
              </h3>
              <p>{x.reasons.join("；")}</p>
              <small>替代方案：{x.alternative}</small>
            </div>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
export function Workflow({ r }: { r: ProjectReport }) {
  const [open, setOpen] = useState("phase-1");
  return (
    <ReportSection id="workflow" title="Agent 执行工作流" lead>
      {r.workflows.map((x, i) => (
        <div
          className={`workflow-detail ${open === x.id ? "open" : ""}`}
          key={x.id}
        >
          <button onClick={() => setOpen(open === x.id ? "" : x.id)}>
            <span className="mono">{String(i + 1).padStart(2, "0")}</span>
            <strong>{x.title}</strong>
            <small>
              {x.agent} · {x.time} · {x.tokens}
            </small>
            <b>{open === x.id ? "−" : "＋"}</b>
          </button>
          {open === x.id && (
            <div className="workflow-body">
              <p>{x.goal}</p>
              <dl>
                <div>
                  <dt>Agent / Model</dt>
                  <dd>
                    {x.agent} / {x.model}
                  </dd>
                </div>
                <div>
                  <dt>工具</dt>
                  <dd>{x.tools.join("、")}</dd>
                </div>
                <div>
                  <dt>输入 → 输出</dt>
                  <dd>
                    {x.input} → {x.output}
                  </dd>
                </div>
                <div>
                  <dt>动作</dt>
                  <dd>{x.actions.join("；")}</dd>
                </div>
                <div>
                  <dt>验收</dt>
                  <dd>{x.acceptance}</dd>
                </div>
                <div>
                  <dt>风险</dt>
                  <dd>{x.risk}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      ))}
    </ReportSection>
  );
}
export function Architecture({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="architecture" title="推荐 Agent 架构">
      <div className="architecture-flow">
        {r.architecture.map((x, i) => (
          <div key={x}>
            <span>{x}</span>
            {i < r.architecture.length - 1 && <i>→</i>}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
export function Estimates({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="estimates" title="时间、Token 与成本">
      <div className="estimate-grid">
        {(
          [
            ["预计 Token", r.estimates.tokens],
            ["项目周期", r.estimates.time],
            ["现金成本", r.estimates.cost],
          ] as const
        ).map(([label, x]) => (
          <div className="estimate card" key={label}>
            <h3>{label}</h3>
            <strong>{x.display}</strong>
            <p>{x.range}</p>
            <Confidence level={x.confidence} />
            {(x.breakdown || []).map((b) => (
              <div className="understood-row" key={b.label}>
                <span>{b.label}</span>
                <b>{b.value}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
      {r.actualUsage && (
        <div className="card actual-usage">
          <h3>本次测评消耗（不计入项目预算）</h3>
          <p>
            {r.actualUsage.provider} · {r.actualUsage.model} · 记录于{" "}
            {new Date(r.actualUsage.recordedAt).toLocaleString("zh-CN")}
          </p>
          <p className="muted">
            以下 Token 仅用于核算本次评估调用，不代表项目开发所需 Token。
          </p>
          <div className="fact-row">
            <span>
              输入 {r.actualUsage.promptTokens.toLocaleString()} Token
            </span>
            <span>
              输出 {r.actualUsage.completionTokens.toLocaleString()} Token
            </span>
            <span>合计 {r.actualUsage.totalTokens.toLocaleString()} Token</span>
          </div>
        </div>
      )}
    </ReportSection>
  );
}
export function Automation({ r }: { r: ProjectReport }) {
  const a = r.estimates.automation;
  return (
    <ReportSection id="automation" title="自动化率">
      <div className="automation-card">
        <div className="automation-number">
          <strong>{a.rate}%</strong>
          <span>AI 可以自动完成</span>
        </div>
        <div>
          <div className="progress">
            <span style={{ width: `${a.rate}%` }} />
          </div>
          <div className="compare-cols">
            <div>
              <b>AI 工作</b>
              <p>{a.aiWork.join("、")}</p>
            </div>
            <div>
              <b>人工节点</b>
              <p>{a.humanWork.join("、")}</p>
            </div>
          </div>
        </div>
      </div>
    </ReportSection>
  );
}
export function Risks({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="risks" title="风险分析" collapsible>
      {r.risks.map((x, i) => (
        <details className="risk-detail" key={`${x.title}-${i}`}>
          <summary>
            <span
              className={`status-chip ${typeof x.level === "string" && x.level.includes("高") ? "bad" : "warn"}`}
            >
              {x.level}
            </span>
            <strong>{x.title}</strong>
            <span>
              概率 {x.probability} · 影响 {x.impact}
            </span>
          </summary>
          <p>{x.advice}</p>
        </details>
      ))}
    </ReportSection>
  );
}
export function ConfidenceBlock({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="confidence" title="预测置信度">
      <div className="confidence-grid">
        {Object.entries(r.confidence)
          .filter(([k]) => k !== "explanation")
          .map(([k, v]) => (
            <div key={k}>
              <span>
                {
                  (
                    {
                      agents: "Agent 推荐",
                      models: "模型推荐",
                      tokens: "Token 预测",
                      time: "时间预测",
                      cost: "成本预测",
                      github: "GitHub 匹配",
                    } as Record<string, string>
                  )[k]
                }
              </span>
              <Confidence level={v as "高" | "中" | "低"} />
            </div>
          ))}
      </div>
      <details>
        <summary>置信度如何计算？</summary>
        <p>{r.confidence.explanation.join("、")}。</p>
      </details>
    </ReportSection>
  );
}
function Confidence({ level }: { level: "高" | "中" | "低" }) {
  return (
    <span
      className={`confidence ${level === "高" ? "good" : level === "中" ? "warn" : "bad"}`}
    >
      ● {level}
    </span>
  );
}
export function Sources({ r }: { r: ProjectReport }) {
  return (
    <ReportSection id="sources" title="分析依据与信息来源" collapsible>
      <p className="muted">
        {r.generationMode === "live"
          ? `本报告由 ${r.provider || "已连接 Provider"} / ${r.model || "已选模型"} 基于当前项目实时生成。GitHub、产品和工具只展示已核验或明确标注为知识库快照的来源；项目实施 Token 与本次评估消耗分开。`
          : r.generationMode === "knowledge-only"
            ? "本报告仅基于本地知识库和规则生成，未完成实时 AI 或联网核验；涉及版本、价格和可用性的信息请先打开来源复核。"
            : "当前是示例报告，不代表已经完成真实 AI 评估。连接 Provider 后点击“重新分析”，系统才会生成实时结论和核验后的来源。"}
      </p>
      {r.knowledge && (
        <div className="source-list">
          <div>
            <span className="mono tiny">知识库快照</span>
            <strong>{r.knowledge.itemCount} 条已发布条目 · 已过滤 {r.knowledge.filteredCount} 条</strong>
            <small>快照：{r.knowledge.snapshotAt || "未知"} · 实时检索：{r.knowledge.liveSearchAt || "未执行"}</small>
            <small>{r.knowledge.coverage}</small>
            {r.knowledge.browserSearch && (
              <small>
                浏览器搜索：{r.knowledge.browserSearch.resultCount} 条结果 · {r.knowledge.browserSearch.searchedAt || "未执行"}
                {r.knowledge.browserSearch.error ? ` · ${r.knowledge.browserSearch.error}` : ""}
              </small>
            )}
          </div>
        </div>
      )}
      <div className="source-list">
        {r.sources.map((x) => (
          <div key={x.id}>
            <span className="mono tiny">{x.type}</span>
            <strong>{x.name}</strong>
            <small>更新时间：{x.updatedAt}</small>
            {x.url && (
              <a href={x.url} target="_blank" rel="noreferrer">
                打开来源 ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
export function ModelCompare({
  models,
  onClose,
}: {
  models: ModelRecommendation[];
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">模型比较</div>
            <h2>当前项目模型能力对比</h2>
          </div>
          <button className="btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>模型</th>
                <th>推理</th>
                <th>编码</th>
                <th>视觉</th>
                <th>视频</th>
                <th>速度</th>
                <th>成本</th>
                <th>匹配度</th>
              </tr>
            </thead>
            <tbody>
              {models.map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                    <small>{x.provider}</small>
                  </td>
                  {Object.values(x.ratings).map((v, i) => (
                    <td key={i}>{v}/5</td>
                  ))}
                  <td>{"$".repeat(Math.max(0, Math.min(5, x.pricingLevel)))}</td>
                  <td>
                    <b>{x.matchScore}%</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export function GithubDrawer({
  item,
  onClose,
}: {
  item: GithubProjectRecommendation;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="mono tiny">{item.repo}</span>
            <h2>{item.name}</h2>
          </div>
          <button className="btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-score">
          <strong>{item.similarity}%</strong>
          <span>项目匹配度</span>
        </div>
        {[
          ["代码成熟度", item.maturity + "%"],
          ["维护活跃度", item.activity + "%"],
          ["二次开发难度", item.difficulty],
          ["可复用比例", item.reuseRatio],
        ].map(([a, b]) => (
          <div className="understood-row" key={a}>
            <span>{a}</span>
            <b>{b}</b>
          </div>
        ))}
        <h3>主要风险</h3>
        <ul>
          {item.risks.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <h3>小君AI测评建议</h3>
        <p>{item.advice}</p>
        <a
          className="btn primary"
          href={item.url}
          target="_blank"
          rel="noreferrer"
        >
          查看 GitHub ↗
        </a>
      </aside>
    </div>
  );
}
function ReportSection({
  id,
  title,
  subtitle,
  children,
  lead,
  collapsible,
  action,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  lead?: boolean;
  collapsible?: boolean;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section id={id} className={`report-block ${lead ? "lead" : ""}`}>
      <header className="block-head">
        <div>
          <span className="mono tiny">{id.toUpperCase()}</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div>
          {action}
          {collapsible && (
            <button className="icon-btn" onClick={() => setOpen(!open)}>
              {open ? "−" : "＋"}
            </button>
          )}
        </div>
      </header>
      {open && <div className="block-body fade-in">{children}</div>}
    </section>
  );
}
