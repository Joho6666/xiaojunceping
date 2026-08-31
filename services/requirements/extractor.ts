import { AnswerValue, IntegrationRequirement, Project, RequirementProfile } from "../../types";
import { classifyDomains, primaryKindFromDomains } from "./classifier";
import { scoreRequirementCompleteness } from "./completeness";

function flattenAnswers(answers: Record<string, AnswerValue>) {
  return Object.values(answers)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text);
}

export function extractRequirementProfile(project: Project, answers: Record<string, AnswerValue> = {}): RequirementProfile {
  const text = `${project.idea} ${flattenAnswers(answers)}`;
  const lower = text.toLowerCase();
  const domains = classifyDomains(text);
  const primaryDomain = domains[0]?.name;
  const projectKind = domains.length ? primaryKindFromDomains(domains) : "general";
  const requiredFeatures: string[] = [];
  const optionalFeatures: string[] = [];
  const capabilities: string[] = [];
  const tags: string[] = domains.map((item) => item.name);
  const stack: string[] = [];
  const integrations: IntegrationRequirement[] = [];
  const constraints: string[] = [];
  const platforms: string[] = [];
  const addFeature = (name: string, capability?: string, tag?: string) => {
    if (!requiredFeatures.includes(name)) requiredFeatures.push(name);
    if (capability && !capabilities.includes(capability)) capabilities.push(capability);
    if (tag && !tags.includes(tag)) tags.push(tag);
  };
  const addIntegration = (type: string, target: string) => {
    if (!integrations.some((item) => item.type === type && item.target === target)) integrations.push({ type, target });
  };

  if (has(lower, /登录|账号|auth|oauth/)) addFeature("login", "认证", "auth");
  if (has(lower, /聊天|chat|im|消息|websocket/)) addFeature("chat", "即时通讯", "chat");
  if (has(lower, /匹配|交友|推荐/)) addFeature("matching", "匹配推荐", "matching");
  if (has(lower, /个人资料|资料|profile/)) addFeature("profile", "用户资料", "profile");
  if (has(lower, /定位|位置|location/)) addFeature("location", "位置服务", "location");
  if (has(lower, /电商|购物|商品|订单|sku|库存/)) {
    addFeature("catalog", "商品目录", "ecommerce");
    addFeature("cart", "购物车与订单", "commerce");
  }
  if (has(lower, /支付|stripe|微信|支付宝/)) {
    addFeature("payment", "支付", "payments");
    addIntegration("payment", has(lower, /stripe/) ? "Stripe" : "payment-provider");
  }
  if (has(lower, /视频|剪辑|字幕|tiktok|抖音/)) addFeature("video-pipeline", "视频处理", "video");
  if (has(lower, /字幕|whisper|转写/)) addFeature("subtitles", "字幕与转写", "subtitle");
  if (has(lower, /pcb|原理图|gerber|kicad/)) addFeature("schematic", "原理图", "pcb");
  if (has(lower, /stm32|esp32|固件|firmware|keil|platformio/)) addFeature("firmware", "固件", "embedded");
  if (has(lower, /cad|dxf|step|stl|治具/)) addFeature("geometry", "几何生成", "cad");
  if (has(lower, /后台|admin|cms/)) addFeature("admin", "后台管理", "admin");
  if (has(lower, /审核|moderation|内容安全/)) addFeature("moderation", "内容审核", "moderation");
  if (has(lower, /自动化|工作流|n8n|webhook|workflow/)) {
    addFeature("workflow", "Workflow", "automation");
    addFeature("api", "API", "api");
    addFeature("webhook", "Webhook", "webhook");
  }
  if (has(lower, /语音助手|voice|windows.*codex|调用.*codex/)) {
    addFeature("voice", "语音交互", "audio");
    addFeature("local-agent", "本机 Agent", "ai-agent");
    addFeature("terminal", "终端执行", "developer-tool");
  }

  if (has(lower, /next\.js|react|typescript/)) stack.push("Next.js", "React", "TypeScript");
  if (has(lower, /supabase|postgres/)) {
    stack.push("Supabase", "PostgreSQL");
    addIntegration("database", "Supabase");
  }
  if (has(lower, /ffmpeg/)) stack.push("FFmpeg");
  if (has(lower, /kicad/)) stack.push("KiCad");
  if (has(lower, /keil/)) stack.push("Keil");
  if (has(lower, /platformio/)) stack.push("PlatformIO");
  if (has(lower, /n8n/)) stack.push("n8n");
  if (has(lower, /github api|仓库 api/)) addIntegration("github", "GitHub API");
  if (has(lower, /聊天|im|websocket/)) addIntegration("im", "realtime-chat");

  if (has(lower, /windows|桌面|electron/)) platforms.push("desktop");
  if (has(lower, /ios|android|小程序|移动|手机/)) platforms.push("mobile");
  if (has(lower, /网站|web|saas|网页/) || has(lower, /后台/) && !domains.some((item) => item.name === "embedded")) platforms.push("web");
  if (has(lower, /stm32|esp32|单片机|嵌入式|温控|固件/) && !platforms.includes("embedded-device")) platforms.push("embedded-device");
  if (has(lower, /本地|self-host|私有部署/)) platforms.push("Self-host");
  if (!platforms.length) platforms.push("unknown");

  if (has(lower, /私有|隐私|敏感|本地部署/)) constraints.push("隐私数据需受控");
  if (has(lower, /gpl|开源协议/)) constraints.push("许可证需可商业使用");

  const researchOnly = has(lower, /值不值得|是否值得|值得做|值不值|评估一下|帮我判断/);
  const implement = has(lower, /开发|实现|构建|写出|部署|上线|修改代码|温控|治具|小程序|网站|系统/) && !researchOnly;
  const wantsRepos = has(lower, /github|开源|仓库|二开|参考项目/);
  const needsGithub = !researchOnly && (wantsRepos || domains.some((item) => ["web", "commerce", "developer-tool"].includes(item.name)));
  const needsLiveSearch = needsGithub || has(lower, /竞品|官方|定价|文档/);

  const goals = unique([project.idea.slice(0, 180)]);
  const dataSensitivity = constraints.some((item) => /隐私|敏感/.test(item)) ? "高" : "未知";
  const numberOfFeatures = requiredFeatures.length;
  const numberOfPlatforms = platforms.filter((item) => item !== "unknown").length;
  const numberOfIntegrations = integrations.length;
  const projectComplexity = Math.min(5, 1 + Math.round(((numberOfFeatures || 1) + numberOfIntegrations + Math.max(numberOfPlatforms, 1)) / 3));

  const profile: RequirementProfile = {
    projectKind,
    legacyKind: project.kind,
    primaryDomain,
    domain: unique(domains.map((item) => item.name)),
    domains,
    goals,
    requiredFeatures,
    optionalFeatures,
    capabilities: unique([...capabilities, ...requiredFeatures]),
    tags: unique(tags),
    stack: unique(stack),
    existingStack: [],
    platforms: unique(platforms),
    targetPlatform: unique(platforms),
    deploymentTarget: unique(platforms.includes("Self-host") ? ["self-host"] : platforms.includes("embedded-device") ? ["device"] : platforms.includes("unknown") ? ["unknown"] : ["cloud"]),
    constraints,
    dataSensitivity,
    needsLiveSearch,
    needsGithub,
    needsMcp: has(lower, /mcp/),
    needsTerminal: has(lower, /cli|终端|固件|编译|codex|改代码/) || domains.some((item) => ["embedded", "developer-tool", "pcb", "cad"].includes(item.name)),
    needsComputerUse: has(lower, /浏览器自动化|computer use|桌面操作|windows/),
    needsBrowser: has(lower, /网页验证|e2e|爬虫/),
    acceptanceCriteria: requiredFeatures.length
      ? requiredFeatures.slice(0, 6).map((feature) => `核心功能 ${feature} 可演示并通过验收`)
      : [],
    projectComplexity,
    numberOfFeatures,
    numberOfIntegrations,
    numberOfPlatforms,
    integrations,
    userType: has(lower, /学生|校园/) ? "学生" : has(lower, /企业|工厂/) ? "企业" : "未确认",
    expectedScale: has(lower, /百万|规模|并发/) ? "需确认规模" : "未知",
    timeline: has(lower, /一周|两周|deadline|天|月/) ? "有时间约束，需确认" : "未知",
    budget: has(lower, /预算|便宜|免费/) ? "成本敏感，需确认" : "未知",
    preferredStack: unique([
      ...stack,
      ...(domains.some((item) => item.name === "video") ? ["FFmpeg"] : []),
      ...(domains.some((item) => item.name === "pcb") ? ["KiCad"] : []),
      ...(domains.some((item) => item.name === "embedded") && has(lower, /keil/) ? ["Keil"] : []),
      ...(domains.some((item) => item.name === "embedded") ? ["PlatformIO"] : []),
      ...(domains.some((item) => item.name === "cad") ? ["FreeCAD"] : []),
      ...(domains.some((item) => item.name === "automation") ? ["n8n"] : []),
    ]),
  };
  profile.completeness = scoreRequirementCompleteness(profile, answers);
  return profile;
}

export function analyzeRequirements(idea: string, answers: Record<string, AnswerValue> = {}) {
  return extractRequirementProfile({
    id: "analyze",
    idea,
    kind: "general",
    evaluationMode: "quick",
    createdAt: new Date().toISOString(),
  }, answers);
}
