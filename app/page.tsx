"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Footer } from "../components/Footer";
import { useApp } from "../components/AppProvider";
import { EvaluationMode } from "../types";
export default function Home() {
  const [idea, setIdea] = useState("");
  const [mode, setMode] = useState<EvaluationMode>("quick");
  const router = useRouter();
  const app = useApp();
  useEffect(() => {
    if (app.hydrated && app.project) setMode(app.project.evaluationMode);
  }, [app.hydrated, app.project]);
  const start = () => {
    if (!idea.trim()) return;
    router.push(`/project/${app.createProject(idea.trim(), mode)}/interview`);
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
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="例如：我想做一个可以自动把长视频剪成 TikTok 短视频的 AI Agent……"
            />
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
        <Footer />
      </div>
    </main>
  );
}
