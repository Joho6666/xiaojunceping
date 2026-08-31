import { DomainName, DomainScore, ProjectKind } from "../../types";

const DOMAIN_PATTERNS: Array<{ name: DomainName; weight: number; pattern: RegExp }> = [
  { name: "commerce", weight: 1, pattern: /电商|商城|购物|支付|订单|sku|库存|零售|服装|卖衣服|stripe/gi },
  { name: "video", weight: 1, pattern: /视频|剪辑|tiktok|抖音|短视频|ffmpeg|字幕|渲染/gi },
  { name: "audio", weight: 0.85, pattern: /音频|语音|tts|whisper|转写|播客|voice/gi },
  { name: "pcb", weight: 1, pattern: /pcb|原理图|gerber|erc|drc|kicad|电路板|bom/gi },
  { name: "embedded", weight: 1, pattern: /stm32|esp32|单片机|firmware|固件|platformio|keil|rtos|嵌入式|温控|传感器|oled|ds18b20/gi },
  { name: "cad", weight: 1, pattern: /cad|solidworks|freecad|step|stl|dxf|建模|治具|出图/gi },
  { name: "industrial", weight: 0.9, pattern: /工业|检测|治具|产线|波峰焊|制造|工厂|gerber/gi },
  { name: "ai-agent", weight: 0.95, pattern: /agent|智能体|mcp|skill|多代理|编排|codex|claude code/gi },
  { name: "automation", weight: 0.85, pattern: /自动化|工作流|n8n|webhook|workflow/gi },
  { name: "web", weight: 0.75, pattern: /网站|web|saas|后台|dashboard|next\.js|react|小程序后台/gi },
  { name: "mobile", weight: 0.9, pattern: /app|ios|android|小程序|移动端|微信|手机/gi },
  { name: "desktop", weight: 0.85, pattern: /桌面|windows|electron|wpf|电脑/gi },
  { name: "data", weight: 0.7, pattern: /数据|etl|分析|报表|warehouse/gi },
  { name: "education", weight: 0.75, pattern: /校园|教育|课程|学习|学生|交友/gi },
  { name: "productivity", weight: 0.6, pattern: /协作|笔记|任务|文档|办公/gi },
  { name: "developer-tool", weight: 0.8, pattern: /cli|sdk|开发者|ide|编译|调试|改代码|terminal/gi },
];

export function classifyDomains(text: string): DomainScore[] {
  const source = text.toLowerCase();
  const scores = DOMAIN_PATTERNS.map(({ name, weight, pattern }) => {
    const hits = source.match(pattern) || [];
    const score = hits.length ? Math.min(0.99, 0.38 + hits.length * 0.18 * weight) : 0;
    return { name, score: Number(score.toFixed(2)) };
  })
    .filter((item) => item.score >= 0.35)
    .sort((a, b) => b.score - a.score);
  return scores.slice(0, 8);
}

export function primaryKindFromDomains(domains: DomainScore[]): ProjectKind {
  const names = new Set(domains.map((item) => item.name));
  const top = domains[0]?.name;
  if (top === "video" || top === "audio") return "video";
  if (top === "cad") return "cad";
  if (names.has("pcb") && (top === "pcb" || (domains.find((item) => item.name === "pcb")?.score || 0) >= 0.5)) return "pcb";
  if (top === "embedded") return "general";
  if (top === "automation") return "automation";
  if (top === "web" || top === "commerce" || top === "education" || top === "productivity") return "web";
  return "general";
}

export function detectProjectKindFromText(idea: string): ProjectKind {
  const domains = classifyDomains(idea);
  if (!domains.length) return "general";
  return primaryKindFromDomains(domains);
}
