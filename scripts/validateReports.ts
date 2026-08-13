import assert from "node:assert/strict";
import { buildMockReport } from "../data/reportCatalog";
import { detectProjectKind } from "../data/questions";
import { ProjectKind } from "../types";
const cases: [string, ProjectKind, string[], string[]][] = [
  [
    "我要做一个 AI TikTok 自动剪辑 Agent。",
    "video",
    ["FFmpeg", "视频", "MoneyPrinterTurbo"],
    [],
  ],
  [
    "我要做一个 SolidWorks 手机支架。",
    "cad",
    ["FreeCAD", "STEP", "STL"],
    ["TikTok", "字幕生成"],
  ],
  [
    "我要做一个 STM32 控制板 PCB。",
    "pcb",
    ["KiCad", "BOM", "Gerber", "DRC"],
    ["TikTok", "FFmpeg"],
  ],
  [
    "我要做一个 AI SaaS 网站。",
    "web",
    ["Next.js", "Supabase", "Vercel"],
    ["Gerber", "SolidWorks"],
  ],
  [
    "我要做一个自动处理邮件的工作流。",
    "automation",
    ["n8n", "邮件", "API"],
    ["FFmpeg", "Gerber"],
  ],
];
for (const [idea, kind, required, forbidden] of cases) {
  assert.equal(detectProjectKind(idea), kind);
  const report = buildMockReport({
    id: kind,
    idea,
    kind,
    evaluationMode: "expert",
    createdAt: new Date().toISOString(),
  });
  const text = JSON.stringify(report);
  for (const word of required)
    assert.ok(text.includes(word), `${kind} 缺少 ${word}`);
  for (const word of forbidden)
    assert.ok(!text.includes(word), `${kind} 不应包含 ${word}`);
  assert.ok(report.models.every((x) => x.provider && x.modelId));
  assert.ok(
    report.workflows.every(
      (x) => x.agent && x.model && x.tools.length && x.acceptance,
    ),
  );
  assert.ok(report.sources.length > 0);
  assert.ok(
    !report.estimates.tokens.display.includes("本次实际"),
    `${kind} 的项目 Token 预算不应使用测评调用量`,
  );
  assert.ok(Array.isArray(report.ecosystem), `${kind} 缺少 AI 生态候选字段`);
}
const oldReport = buildMockReport({
  id: "legacy",
  idea: "我要做一个网站",
  kind: "web",
  evaluationMode: "expert",
  createdAt: new Date().toISOString(),
});
assert.ok(
  oldReport.estimates.tokens.display.trim() &&
    oldReport.estimates.tokens.range.trim(),
  "项目 Token 预算缺失",
);
console.log(`✓ ${cases.length} 类项目报告数据隔离与结构校验通过`);
