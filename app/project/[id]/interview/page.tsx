"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp } from "../../../../components/AppProvider";
import { getQuestions } from "../../../../data/questions";
import {
  calculateCompleteness,
  getNextQuestion,
} from "../../../../services/interviewService";
import { AnswerValue, InterviewQuestion } from "../../../../types";
export default function Interview() {
  const app = useApp(),
    router = useRouter(),
    params = useParams();
  const mode = app.project?.evaluationMode || "expert";
  const allQuestions = useMemo(
    () => getQuestions(app.project?.kind || "general"),
    [app.project?.kind],
  );
  const quickQuestions = useMemo(
    () =>
      app.project
        ? allQuestions
            .filter((q) =>
              [
                "stage",
                "deliverables",
                "priority",
                "goal",
                "resources",
                "acceptance",
              ].includes(q.id),
            )
            .slice(0, 3)
        : [],
    [allQuestions, app.project],
  );
  const questions = mode === "quick" ? quickQuestions : allQuestions;
  const index = Math.min(
    app.currentQuestion,
    Math.max(questions.length - 1, 0),
  );
  const question = questions[index];
  const [value, setValue] = useState<AnswerValue>("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (question)
      setValue(
        app.answers[question.id] ??
          (question.type === "ranking"
            ? question.options?.map((o) => o.label) || []
            : ""),
      );
  }, [question, app.answers]);
  if (!app.hydrated) return <div className="content">正在恢复项目…</div>;
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
  if (!app.project)
    return (
      <div className="content">
        <h1>未找到项目</h1>
        <button className="btn" onClick={() => router.push("/")}>
          返回首页
        </button>
      </div>
    );
  if (!question)
    return (
      <main>
        <div className="quick-interview-empty">
          <div className="eyebrow">
            {mode === "quick" ? "快速模式" : "专家模式"}
          </div>
          <h1>已有足够信息开始分析</h1>
          <p>AI 已从你的项目描述中识别出关键上下文，可以直接生成评估方案。</p>
          <button
            className="btn primary"
            onClick={() => router.push(`/project/${params.id}/confirm`)}
          >
            确认需求并开始分析 →
          </button>
        </div>
      </main>
    );
  const completeness = calculateCompleteness(app.answers, allQuestions);
  const select = (label: string) => {
    if (question.type === "multi-choice") {
      const arr = Array.isArray(value) ? value : [];
      setValue(
        arr.includes(label) ? arr.filter((x) => x !== label) : [...arr, label],
      );
    } else setValue(label);
  };
  const move = (from: number, delta: number) => {
    const arr = [...(Array.isArray(value) ? value : [])],
      to = Math.max(0, Math.min(arr.length - 1, from + delta));
    [arr[from], arr[to]] = [arr[to], arr[from]];
    setValue(arr);
  };
  const go = (next: number) => {
    app.setAnswer(question.id, value);
    app.setCurrentQuestion(next);
  };
  const save = () => {
    const valid = Array.isArray(value)
      ? value.length > 0 && (!value.includes("自定义") || value.some((item) => item.startsWith("自定义：") && item.slice(4).trim()))
      : Boolean(String(value).trim());
    if (!valid) {
      setNotice("请先完成当前问题。");
      return;
    }
    app.setAnswer(question.id, value);
    setNotice(
      `✓ 已确认：${Array.isArray(value) ? value.slice(0, 3).join(" → ") : value}`,
    );
    setTimeout(() => {
      if (index === questions.length - 1)
        router.push(`/project/${params.id}/confirm`);
      else {
        app.setCurrentQuestion(index + 1);
        setNotice("");
      }
    }, 300);
  };
  return (
    <main>
      <div className="subhead">
        <div className="container">
          <div className="eyebrow">
            {mode === "quick"
              ? "快速评估 · 只问关键问题"
              : "专家模式 · 深度需求访谈"}
          </div>
          <div className="muted">项目：{app.project.idea}</div>
        </div>
      </div>
      {mode === "quick" ? (
        <section className="quick-interview">
          <div className="quick-progress">
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <span className={i <= index ? "active" : ""}>{i + 1}</span>
                {i < questions.length - 1 && (
                  <i className={i < index ? "active" : ""} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="eyebrow">
            问题 {index + 1} / {questions.length}
          </div>
          <h1>
            为了给你一个靠谱方案，
            <br />
            我还需要确认这件事
          </h1>
          <p className="quick-question-description">{question.title}</p>
          <QuestionInput
            question={question}
            value={value}
            setValue={setValue}
            select={select}
            move={move}
          />
          <div className="quick-understood">
            <span>AI 已经理解</span>
            <strong>
              {app.project.kind === "video"
                ? "AI 视频 Agent · 项目执行方案"
                : `${app.project.kind.toUpperCase()} 项目 · 正在判断最佳实现方式`}
            </strong>
          </div>
          <div className="answer-actions">
            <span className="hint">{notice}</span>
            <div>
              <button
                className="btn"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                上一题
              </button>{" "}
              <button className="btn primary" onClick={save}>
                {index === questions.length - 1 ? "开始分析" : "确认并继续 →"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="interview-grid">
          <section className="interview-main">
            <div className="chat-bubble">
              ◉　我会逐步了解你的项目，并同步更新项目决策依据。
            </div>
            <div className="question fade-in" key={question.id}>
              <div className="eyebrow">
                问题 {index + 1} / {questions.length} · {question.category}
              </div>
              <h2>{question.title}</h2>
              <p>{question.description}</p>
              <QuestionInput
                question={question}
                value={value}
                setValue={setValue}
                select={select}
                move={move}
              />
              <div className="answer-actions">
                <span className="hint">{notice}</span>
                <div>
                  <button
                    className="btn"
                    disabled={index === 0}
                    onClick={() => go(index - 1)}
                  >
                    上一题
                  </button>{" "}
                  <button className="btn primary" onClick={save}>
                    {index === questions.length - 1
                      ? "完成访谈"
                      : "确认并继续 →"}
                  </button>
                </div>
              </div>
            </div>
          </section>
          <Understanding
            answers={app.answers}
            questions={allQuestions}
            completeness={completeness}
          />
        </div>
      )}
    </main>
  );
}
function QuestionInput({
  question,
  value,
  setValue,
  select,
  move,
}: {
  question: InterviewQuestion;
  value: AnswerValue;
  setValue: (v: AnswerValue) => void;
  select: (v: string) => void;
  move: (i: number, d: number) => void;
}) {
  const customValues = Array.isArray(value)
    ? value.filter((item) => item.startsWith("自定义："))
    : [];
  const customText = customValues[0]?.slice("自定义：".length) || "";
  const hasCustom = customValues.length > 0 || (Array.isArray(value) && value.includes("自定义"));
  const updateCustom = (text: string) => {
    const current = Array.isArray(value) ? value.filter((item) => item !== "自定义" && !item.startsWith("自定义：")) : [];
    setValue([...current, `自定义：${text}`]);
  };
  return (
    <>
      {["text", "textarea"].includes(question.type) &&
        React.createElement(
          question.type === "textarea" ? "textarea" : "input",
          {
            value: String(value),
            onChange: (
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => setValue(e.target.value),
            placeholder: "请填写你的答案…",
            style: {
              marginTop: 20,
              minHeight: question.type === "textarea" ? 150 : undefined,
            },
          },
        )}
      {question.type === "ranking" && (
        <div className="ranking-list">
          {(Array.isArray(value) ? value : []).map((label, i) => (
            <div className="ranking-item card" key={label}>
              <span className="rank mono">
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong>{label}</strong>
              <div>
                <button
                  className="icon-btn"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  className="icon-btn"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {["single-choice", "multi-choice"].includes(question.type) && (
        <div className="options">
          {question.options?.map((option) => {
            const selected = Array.isArray(value)
              ? option.label === "自定义"
                ? hasCustom
                : value.includes(option.label)
              : value === option.label;
            return (
              <button
                className={`option ${selected ? "selected" : ""}`}
                key={option.label}
                onClick={() => select(option.label)}
              >
                <strong>
                  {selected ? "✓ " : ""}
                  {option.label}
                </strong>
                {option.description && <small>{option.description}</small>}
              </button>
            );
          })}
          {question.id === "deliverables" && hasCustom && (
            <input
              className="custom-answer-input"
              value={customText}
              onChange={(event) => updateCustom(event.target.value)}
              placeholder="例如：服装品牌电商网站、内部管理后台…"
              aria-label="填写自定义项目名称或交付物"
              autoFocus
            />
          )}
        </div>
      )}
    </>
  );
}
function Understanding({
  answers,
  questions,
  completeness,
}: {
  answers: Record<string, AnswerValue>;
  questions: ReturnType<typeof getQuestions>;
  completeness: number;
}) {
  return (
    <aside className="interview-side">
      <div className="side-card card">
        <div className="progress-label">
          <b>需求完整度</b>
          <span>{completeness}%</span>
        </div>
        <div className="progress">
          <span style={{ width: `${completeness}%` }} />
        </div>
        <p className="muted">
          {completeness >= 85
            ? "可以开始分析"
            : completeness >= 40
              ? "正在完善"
              : "信息不足"}
        </p>
      </div>
      <div className="side-card card">
        <h3>AI 已理解</h3>
        {Object.entries(answers)
          .slice(-7)
          .map(([key, v]) => (
            <div className="understood-row" key={key}>
              <span>
                {questions.find((q) => q.id === key)?.category || "项目"}
              </span>
              <strong>{Array.isArray(v) ? v.slice(0, 2).join("、") : v}</strong>
            </div>
          ))}
      </div>
      <div className="side-card card">
        <h3>还需要了解</h3>
        <div className="missing">
          {questions
            .filter((q) => !answers[q.id])
            .slice(0, 5)
            .map((q) => (
              <span key={q.id}>● {q.category}</span>
            ))}
        </div>
      </div>
    </aside>
  );
}
