import { ProjectReport } from "../types";

export function reportToMarkdown(r: ProjectReport) {
  const evidence = (r.evidence || []).map((item) => `- [${item.type}/${item.confidence}] ${item.title}${item.url ? ` (${item.url})` : ""}`).join("\n") || "- 无";
  const unknowns = (r.unknownFields || []).map((item) => `- ${item}`).join("\n") || "- 无";
  const next = (r.nextActions || []).map((item, index) => `${index + 1}. ${item}`).join("\n") || "- 无";
  const decisions = (r.decisionLog || []).map((item) => `- ${item.decision}：选择 ${item.chosen}。${item.reason}`).join("\n") || "- 无";
  const models = r.models.map((x) => `- ${x.roleKind === "evaluator" ? "[评估器] " : "[执行] "}${x.name}（${x.modelId}）：${x.task}`).join("\n");
  return `# ${r.projectSummary.title}

> ${r.projectSummary.verdict}

- 引擎：${r.evaluationEngineVersion || "unknown"} · 模式：${r.generationMode || "unknown"} · 检索：${r.retrievalMode || "lexical"}
- 评估模型：${r.evaluator ? `${r.evaluator.provider}/${r.evaluator.model}` : `${r.provider || ""}/${r.model || ""}`}
- 综合评分：${r.projectSummary.score}/100 · 状态：${r.projectSummary.status}
- 推荐策略：${r.strategy.type}（${r.strategy.confidence}%）
- 分析时间：${new Date(r.generatedAt).toLocaleString("zh-CN")}

## 项目理解
${r.projectSummary.summary}

## 推荐组合
${r.strategy.recipe.map((x) => `- ${x}`).join("\n")}

## Agent
${r.agents.map((x) => `- ${x.name}：${x.role}。${x.reason}`).join("\n")}

## 模型
${models}

## GitHub 参考
${r.githubProjects.map((x) => `- [${x.name}](${x.url})：匹配 ${x.similarity}%${x.scoreBreakdown ? `（领域 ${x.scoreBreakdown.domain} / 功能 ${x.scoreBreakdown.feature} / 技术栈 ${x.scoreBreakdown.stack}）` : ""}；许可建议 ${x.licenseUse || x.license}`).join("\n") || "- 无已核验仓库"}

## 技术栈
${r.techStack.map((x) => `- ${x.layer}：${x.name} — ${x.reasons.join("；")}`).join("\n")}

## 工作流
${r.workflows.map((x, i) => `${i + 1}. ${x.title}：${x.output}`).join("\n")}

## 估算
- Token：${r.estimates.tokens.display}（${r.estimates.tokens.range}）
- 时间：${r.estimates.time.display}
- 成本：${r.estimates.cost.display}
- 自动化率：${r.estimates.automation.rate}%

## 未知项
${unknowns}

## 下一步
${next}

## 证据
${evidence}

## 决策记录
${decisions}

## 验收标准
${r.projectSummary.acceptanceCriteria.map((x) => `- [ ] ${x}`).join("\n")}
`;
}

export function downloadText(filename: string, text: string, type: string) {
  if (typeof document === "undefined") throw new Error("下载功能只能在浏览器中使用");
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
