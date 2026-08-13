"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp, newJob } from "../../../../components/AppProvider";
import { getRequirementPreview } from "../../../../services/projectService";
export default function Confirm() {
  const app = useApp(),
    router = useRouter(),
    params = useParams();
  const [checked, setChecked] = useState<string[]>([]);
  const preview = useMemo(
    () => (app.project ? getRequirementPreview(app.project) : null),
    [app.project],
  );
  if (!app.hydrated) return <div className="content">正在恢复需求…</div>;
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
  if (!app.project || !preview)
    return <div className="content">未找到项目。</div>;
  const value = (id: string, fallback: string) => {
    const v = app.answers[id];
    return Array.isArray(v) ? v.join("、") : v || fallback;
  };
  return (
    <main>
      <div className="confirm-layout">
        <aside className="sidebar">
          <p className="sidebar-title">项目需求</p>
          <div className="sidebar-item active">▣ 完整度面板</div>
          <div className="sidebar-item">▤ 项目总结</div>
          <div className="sidebar-item">☑ 验收标准清单</div>
        </aside>
        <section className="content">
          <div className="eyebrow">需求确认</div>
          <h1>确认项目需求</h1>
          <p className="muted">确认后将开始技术研究、方案匹配与成本估算。</p>
          <div className="summary-grid">
            <div className="card summary-card">
              <h3>AI 对项目的理解</h3>
              <p>{preview.summary}</p>
              <small className="mono">
                TYPE: {preview.typeLabel}　·　STRATEGY:{" "}
                {value("strategy", "平衡模式")}
              </small>
            </div>
            <div className="card summary-card score-big">
              <span>需求完整度</span>
              <strong>
                92<small>%</small>
              </strong>
              <span>已具备分析条件</span>
            </div>
          </div>
          <div className="param-grid">
            {[
              ["项目类型", preview.typeLabel],
              ["目标用户", value("audience", "待确认")],
              ["完成标准", value("stage", "商业 MVP")],
              ["开发周期", value("timeline", "无严格期限")],
              ["优先级", value("priority", "效果 → 速度 → 成本")],
              ["人工参与", value("participation", "关键节点确认")],
            ].map(([label, val]) => (
              <div className="card param" key={label}>
                <label>{label}</label>
                <strong>{val}</strong>
              </div>
            ))}
          </div>
          <div className="card checklist">
            <h3>项目验收标准</h3>
            {preview.acceptanceCriteria.map((item) => (
              <label className="check-row" key={item}>
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() =>
                    setChecked((x) =>
                      x.includes(item)
                        ? x.filter((y) => y !== item)
                        : [...x, item],
                    )
                  }
                />
                {item}
              </label>
            ))}
          </div>
          <div className="bottom-actions">
            <button
              className="btn"
              onClick={() => router.push(`/project/${params.id}/interview`)}
            >
              返回修改
            </button>
            <button
              className="btn primary"
              onClick={() => {
                app.setAnalysisJob(newJob());
                router.push(`/project/${params.id}/analysis`);
              }}
            >
              确认需求并开始分析 →
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
