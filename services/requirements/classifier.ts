import { DomainName, DomainScore } from "../../types";

const DOMAIN_PATTERNS: Array<{ name: DomainName; weight: number; pattern: RegExp }> = [
  { name: "commerce", weight: 1, pattern: /电商|商城|购物|支付|订单|sku|库存|零售|服装|卖衣服/i },
  { name: "video", weight: 1, pattern: /视频|剪辑|tiktok|短视频|ffmpeg|字幕|渲染/i },
  { name: "audio", weight: 0.8, pattern: /音频|语音|tts|whisper|转写|播客/i },
  { name: "pcb", weight: 1, pattern: /pcb|原理图|gerber|erc|drc|kicad|电路板/i },
  { name: "embedded", weight: 1, pattern: /stm32|单片机|firmware|固件|platformio|keil|rtos|嵌入式/i },
  { name: "cad", weight: 1, pattern: /cad|solidworks|freecad|step|stl|dxf|建模|治具/i },
  { name: "industrial", weight: 0.85, pattern: /工业|检测|治具|产线|波峰焊|制造|工厂/i },
  { name: "ai-agent", weight: 0.9, pattern: /agent|智能体|mcp|skill|多代理|编排/i },
  { name: "automation", weight: 0.85, pattern: /自动化|工作流|n8n|webhook|邮件|workflow/i },
  { name: "web", weight: 0.7, pattern: /网站|web|saas|后台|dashboard|next\.js|react|平台/i },
  { name: "mobile", weight: 0.85, pattern: /app|ios|android|小程序|移动端/i },
  { name: "desktop", weight: 0.7, pattern: /桌面|windows|electron|wpf/i },
  { name: "data", weight: 0.7, pattern: /数据|etl|分析|报表|warehouse/i },
  { name: "education", weight: 0.7, pattern: /校园|教育|课程|学习|学生/i },
  { name: "productivity", weight: 0.6, pattern: /协作|笔记|任务|文档|办公/i },
  { name: "developer-tool", weight: 0.75, pattern: /cli|sdk|开发者|ide|编译|调试/i },
];

export function classifyDomains(text: string): DomainScore[] {
  const source = text.toLowerCase();
  const scores = DOMAIN_PATTERNS.map(({ name, weight, pattern }) => {
    const hits = source.match(pattern);
    const score = hits ? Math.min(0.99, 0.35 + hits.length * 0.22 * weight) : 0;
    return { name, score: Number(score.toFixed(2)) };
  })
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score);
  if (!scores.length) return [{ name: "web", score: 0.4 }];
  return scores.slice(0, 6);
}

export function primaryKindFromDomains(domains: DomainScore[]): "video" | "web" | "cad" | "pcb" | "automation" | "general" {
  const top = domains[0]?.name;
  if (top === "video" || top === "audio") return "video";
  if (top === "cad") return "cad";
  if (top === "pcb") return "pcb";
  if (top === "automation") return "automation";
  if (top === "web" || top === "commerce" || top === "education" || top === "productivity") return "web";
  if (top === "embedded" || top === "industrial") return domains.some((d) => d.name === "pcb") ? "pcb" : "general";
  return "general";
}
