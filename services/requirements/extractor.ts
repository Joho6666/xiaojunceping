import { AnswerValue, Project, RequirementProfile } from "../../types";
import { classifyDomains, primaryKindFromDomains } from "./classifier";

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
  const projectKind = project.kind || primaryKindFromDomains(domains);
  const requiredFeatures: string[] = [];
  const optionalFeatures: string[] = [];
  const capabilities: string[] = [];
  const tags: string[] = domains.map((item) => item.name);
  const stack: string[] = [];
  const constraints: string[] = [];
  const platforms: string[] = [];
  const addFeature = (name: string, capability?: string, tag?: string) => {
    if (!requiredFeatures.includes(name)) requiredFeatures.push(name);
    if (capability && !capabilities.includes(capability)) capabilities.push(capability);
    if (tag && !tags.includes(tag)) tags.push(tag);
  };

  if (has(lower, /登录|账号|auth|oauth/)) addFeature("login", "认证", "auth");
  if (has(lower, /聊天|chat|im|消息/)) addFeature("chat", "即时通讯", "chat");
  if (has(lower, /匹配|交友|推荐/)) addFeature("matching", "匹配推荐", "matching");
  if (has(lower, /个人资料|资料|profile/)) addFeature("profile", "用户资料", "profile");
  if (has(lower, /定位|位置|location/)) addFeature("location", "位置服务", "location");
  if (has(lower, /电商|购物|商品|支付|订单|sku|库存/)) {
    addFeature("catalog", "商品目录", "ecommerce");
    addFeature("cart", "购物车与订单", "commerce");
    if (has(lower, /支付|stripe|微信|支付宝/)) addFeature("payment", "支付", "payments");
  }
  if (has(lower, /视频|剪辑|字幕|tiktok/)) addFeature("video-pipeline", "视频处理", "video");
  if (has(lower, /字幕|whisper|转写/)) addFeature("subtitles", "字幕与转写", "subtitle");
  if (has(lower, /pcb|原理图|gerber/)) addFeature("schematic", "原理图", "pcb");
  if (has(lower, /stm32|固件|firmware/)) addFeature("firmware", "固件", "embedded");
  if (has(lower, /cad|dxf|step|stl|治具/)) addFeature("geometry", "几何生成", "cad");
  if (has(lower, /后台|admin|cms/)) addFeature("admin", "后台管理", "admin");
  if (has(lower, /审核|moderation|内容安全/)) addFeature("moderation", "内容审核", "moderation");
  if (has(lower, /自动化|工作流|n8n|webhook|workflow/)) {
    addFeature("workflow", "Workflow", "automation");
    addFeature("api", "API", "api");
    addFeature("webhook", "Webhook", "webhook");
  }

  if (has(lower, /next\.js|react|typescript/)) stack.push("Next.js", "React", "TypeScript");
  if (has(lower, /supabase|postgres/)) stack.push("Supabase", "PostgreSQL");
  if (has(lower, /ffmpeg/)) stack.push("FFmpeg");
  if (has(lower, /kicad/)) stack.push("KiCad");
  if (has(lower, /platformio|keil/)) stack.push("PlatformIO");
  if (has(lower, /n8n/)) stack.push("n8n");

  if (has(lower, /windows|桌面/)) platforms.push("Windows");
  if (has(lower, /ios|android|小程序|移动/)) platforms.push("Mobile");
  if (has(lower, /web|网站|saas|后台/) || !platforms.length) platforms.push("Web");
  if (has(lower, /本地|self-host|私有部署/)) platforms.push("Self-host");

  if (has(lower, /私有|隐私|敏感|本地部署/)) constraints.push("隐私数据需受控");
  if (has(lower, /gpl|开源协议/)) constraints.push("许可证需可商业使用");

  const goals = unique([project.idea.slice(0, 180)]);
  const dataSensitivity = constraints.some((item) => /隐私|敏感/.test(item)) ? "高" : "未知";
  const numberOfFeatures = requiredFeatures.length || Math.max(2, domains.length);
  const numberOfPlatforms = platforms.length || 1;
  const numberOfIntegrations = stack.length;
  const projectComplexity = Math.min(5, 1 + Math.round((numberOfFeatures + numberOfIntegrations + numberOfPlatforms) / 3));

  return {
    projectKind,
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
    deploymentTarget: unique(platforms.includes("Self-host") ? ["self-host"] : ["cloud"]),
    constraints,
    dataSensitivity,
    needsLiveSearch: true,
    needsGithub: has(lower, /github|开源|仓库/) || true,
    needsMcp: has(lower, /mcp/),
    needsTerminal: has(lower, /cli|终端|固件|编译/) || domains.some((item) => ["embedded", "developer-tool", "pcb", "cad"].includes(item.name)),
    needsComputerUse: has(lower, /浏览器自动化|computer use|桌面操作/),
    needsBrowser: has(lower, /网页验证|e2e|爬虫/),
    acceptanceCriteria: requiredFeatures.length
      ? requiredFeatures.slice(0, 6).map((feature) => `核心功能 ${feature} 可演示并通过验收`)
      : [`${project.idea.slice(0, 40)} 的最小闭环可演示`],
    projectComplexity,
    numberOfFeatures,
    numberOfIntegrations,
    numberOfPlatforms,
    userType: has(lower, /学生|校园/) ? "学生" : has(lower, /企业|工厂/) ? "企业" : "未确认",
    expectedScale: has(lower, /百万|规模|并发/) ? "需确认规模" : "未知",
    timeline: has(lower, /一周|两周|deadline/) ? "有时间约束，需确认" : "未知",
    budget: has(lower, /预算|便宜|免费/) ? "成本敏感，需确认" : "未知",
    preferredStack: unique([
      ...stack,
      ...(domains.some((item) => item.name === "video") ? ["FFmpeg"] : []),
      ...(domains.some((item) => item.name === "pcb") ? ["KiCad"] : []),
      ...(domains.some((item) => item.name === "embedded") ? ["PlatformIO"] : []),
      ...(domains.some((item) => item.name === "cad") ? ["FreeCAD"] : []),
      ...(domains.some((item) => item.name === "automation") ? ["n8n"] : []),
    ]),
  };
}
