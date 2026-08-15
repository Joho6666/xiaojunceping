"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Footer } from "../components/Footer";
import { useApp } from "../components/AppProvider";
import { EvaluationMode, ProviderConnection } from "../types";

const productHighlights = [
  {
    image: "/images/product/screen-01.png",
    title: "项目结论与可行性判断",
    description: "从目标、约束和访谈答案出发，给出项目专属结论、评分、风险和下一步建议。",
  },
  {
    image: "/images/product/screen-03.png",
    title: "GitHub 与类似产品参考",
    description: "检索并核验真实开源项目、竞品和产品来源，说明可以借鉴什么，以及哪些内容不应照搬。",
  },
  {
    image: "/images/product/screen-05.png",
    title: "Agent、模型与工具匹配",
    description: "根据项目目标生成 Agent 队列、模型路由、工具链和执行顺序，而不是套用固定推荐。",
  },
  {
    image: "/images/product/screen-09.png",
    title: "可执行的 Agent Workflow",
    description: "把研究、实现、测试、审查和交付拆成有输入、有输出、有验收标准的阶段。",
  },
  {
    image: "/images/product/screen-12.png",
    title: "项目专属 Prompt 与 AGENTS.md",
    description: "一键生成适配 Codex、Claude Code、Cursor 和 OpenCode 的执行 Prompt 与工作流文件。",
  },
  {
    image: "/images/product/screen-17.png",
    title: "持续更新的 AI 生态知识库",
    description: "沉淀模型、Agent、Skill、MCP、Plugin 和本机能力，支持同步公开来源、扫描和导入。",
  },
];

export default function Home() {
  const [idea, setIdea] = useState("");
  const [mode, setMode] = useState<EvaluationMode>("quick");
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const router = useRouter();
  const app = useApp();
  useEffect(() => {
    if (app.hydrated && app.project) setMode(app.project.evaluationMode);
  }, [app.hydrated, app.project]);
  useEffect(() => {
    if (!app.hydrated) return;
    fetch("/api/connections")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const available = (data?.connections || []).filter((item: ProviderConnection) => item.status === "connected");
        setConnections(available);
        if (!selectedConnectionId && available[0]) setSelectedConnectionId(available[0].id);
      })
      .catch(() => undefined);
  }, [app.hydrated, selectedConnectionId]);
  const start = () => {
    if (!idea.trim()) return;
    const selected = connections.find((item) => item.id === selectedConnectionId);
    router.push(`/project/${app.createProject(idea.trim(), mode, selected ? { id: selected.id, model: selected.model } : undefined)}/interview`);
  };
  return (
    <main>
      <div className="container">
        <section className="hero fade-in">
          <div className="eyebrow">AI 项目评估与执行规划</div>
          <h1>
            从一个项目想法，
            <br />
            到一套真正可执行的 AI 方案
          </h1>
          <p>
            描述你想做的项目，选择评估深度，AI 会为你匹配
            Agent、模型、工具和工作流，并预测时间、Token、成本与风险。
          </p>
          <div className="card idea-card">
            <label className="field-label">
              <span style={{ color: "#2458c7" }}>◆</span> 描述你的项目
            </label>
            <div className="idea-input-shell">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="例如：我想做一个可以自动把长视频剪成 TikTok 短视频的 AI Agent……"
              />
              <div className="idea-input-toolbar">
                <span className="idea-model-icon">◆</span>
                <span className="idea-model-label">模型</span>
                {connections.length ? (
                  <select
                    className="idea-model-select"
                    aria-label="选择本次评估使用的模型"
                    value={selectedConnectionId}
                    onChange={(e) => setSelectedConnectionId(e.target.value)}
                  >
                    {connections.map((connection) => (
                      <option value={connection.id} key={connection.id}>
                        {connection.displayName} · {connection.model || "Provider 默认模型"} · {connection.mode === "cli" ? "本地 CLI" : "API Key"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <a className="idea-model-empty" href="/settings/ai">去绑定模型</a>
                )}
                <span className="idea-model-chevron">⌄</span>
              </div>
            </div>
            <div className="mode-heading">
              <span>评估方式</span>
              <small>首次使用默认快速模式</small>
            </div>
            <div className="mode-picker">
              {(
                [
                  [
                    "quick",
                    "快速模式",
                    "推荐",
                    "3 个关键问题 · 约 1 分钟",
                    "适合快速判断项目怎么做。",
                  ],
                  [
                    "expert",
                    "专家模式",
                    "",
                    "深度需求分析 · 专业执行方案",
                    "适合准备真正开始项目的开发者。",
                  ],
                ] as const
              ).map(([value, title, badge, sub, desc]) => (
                <button
                  type="button"
                  key={value}
                  className={`mode-card ${mode === value ? "active" : ""}`}
                  onClick={() => setMode(value)}
                >
                  <span className="mode-card-top">
                    <strong>{title}</strong>
                    {badge && <i>{badge}</i>}
                  </span>
                  <b>{sub}</b>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
            <button
              className="btn primary"
              disabled={!idea.trim()}
              onClick={start}
            >
              {idea.trim()
                ? mode === "quick"
                  ? "开始快速评估"
                  : "开始专家评估"
                : "请先描述你的项目"}
            </button>
          </div>
        </section>
        <section className="flow-strip">
          <div className="card flow-card">
            <h3>你的想法</h3>
            <p>告诉 AgentScope 你想做什么，以及最重要的目标和约束。</p>
          </div>
          <span>→</span>
          <div className="card flow-card">
            <h3>{mode === "quick" ? "快速确认" : "AI 需求访谈"}</h3>
            <p>
              {mode === "quick"
                ? "只问最影响方案判断的关键问题。"
                : "动态补齐目标用户、交付物、已有资源与验收标准。"}
            </p>
            <div className="progress">
              <span style={{ width: mode === "quick" ? "28%" : "54%" }} />
            </div>
          </div>
          <span>→</span>
          <div className="card flow-card result">
            <h3>最终得到</h3>
            <div className="mock-report">
              <b>{mode === "quick" ? "快速评估报告" : "项目决策报告"}</b>
              <span className="mock-score">84</span>
              <p>实现策略 · Agent · 具体模型</p>
              <p>
                {mode === "quick"
                  ? "时间 · Token · 成本"
                  : "GitHub · 技术栈 · 工作流"}
              </p>
              <p>
                {mode === "quick"
                  ? "最小工程计划 · 主要风险"
                  : "时间 · Token · 成本 · 风险"}
              </p>
            </div>
          </div>
        </section>
        <section className="product-preview-section fade-in" aria-labelledby="product-preview-title">
          <div className="product-preview-intro">
            <div>
              <div className="eyebrow">PRODUCT WORKSPACE</div>
              <h2 id="product-preview-title">从项目想法，到一套能执行的方案</h2>
              <p>
                AgentScope 会把项目描述、已选模型、知识库和实时来源连接起来，输出可解释、可复用、可交付的评估结果。
              </p>
            </div>
            <a className="btn" href="/settings/knowledge">查看知识库</a>
          </div>
          <div className="product-preview-grid">
            {productHighlights.map((item) => (
              <article className="product-preview-card" key={item.title}>
                <div className="product-preview-image-wrap">
                  <Image src={item.image} alt={item.title} width={800} height={450} />
                </div>
                <div className="product-preview-copy">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="product-preview-note">
            <strong>一次评估的完整链路</strong>
            <span>项目输入 → 需求画像 → 知识库检索 → 来源核验 → Agent / 模型匹配 → 报告与 Prompt</span>
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}
