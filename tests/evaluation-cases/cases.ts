export interface GoldenCase {
  id: string;
  idea: string;
  required: string[];
  forbidden: string[];
  domains: string[];
}

export const goldenCases: GoldenCase[] = [
  { id: "stm32-temp", idea: "STM32 温控系统，需要固件、传感器采集和 PID 控制", required: ["embedded", "firmware", "STM32"], forbidden: ["FFmpeg", "Shopify", "TikTok"], domains: ["embedded"] },
  { id: "tiktok-cut", idea: "AI TikTok 自动剪辑，长视频切片并生成字幕", required: ["video", "字幕", "FFmpeg"], forbidden: ["KiCad", "Gerber", "STM32"], domains: ["video"] },
  { id: "campus-social", idea: "校园交友平台，需要登录、资料、匹配、聊天和内容审核", required: ["login", "profile", "matching", "chat", "moderation"], forbidden: ["CAD", "PCB", "FFmpeg"], domains: ["education", "web"] },
  { id: "wave-solder", idea: "波峰焊治具 CAD 自动生成，从 Gerber 生成 DXF 几何", required: ["CAD", "Gerber", "DXF"], forbidden: ["Shopify", "TikTok", "Blog"], domains: ["cad", "industrial"] },
  { id: "fashion-shop", idea: "卖衣服的电商网站，支持商品、SKU、库存、购物车和支付", required: ["ecommerce", "catalog", "payment"], forbidden: ["FFmpeg", "KiCad"], domains: ["commerce", "web"] },
  { id: "email-flow", idea: "自动处理邮件的工作流，失败要重试", required: ["automation"], forbidden: ["FFmpeg", "Gerber"], domains: ["automation"] },
  { id: "ai-saas", idea: "做一个 AI SaaS 网站，需要账号系统和后台", required: ["web", "login", "admin"], forbidden: ["Gerber", "SolidWorks"], domains: ["web"] },
  { id: "industrial-agent", idea: "STM32 + Web 后台 + AI Agent 工业检测系统", required: ["embedded", "web", "ai-agent"], forbidden: ["TikTok", "Shopify"], domains: ["embedded", "web", "ai-agent", "industrial"] },
  { id: "phone-stand", idea: "用 SolidWorks 做手机支架并导出 STEP/STL", required: ["cad"], forbidden: ["TikTok", "字幕生成"], domains: ["cad"] },
  { id: "stm32-pcb", idea: "做一个 STM32 控制板 PCB，需要原理图和 Gerber", required: ["pcb", "schematic"], forbidden: ["TikTok", "FFmpeg"], domains: ["pcb", "embedded"] },
  { id: "podcast", idea: "播客音频转写和摘要，需要 Whisper", required: ["audio"], forbidden: ["KiCad", "Gerber"], domains: ["audio"] },
  { id: "mini-order", idea: "微信小程序餐厅点餐，需要菜单、订单和支付", required: ["mobile", "payment"], forbidden: ["FFmpeg", "KiCad"], domains: ["mobile", "commerce"] },
  { id: "electron-note", idea: "Windows Electron 桌面笔记应用", required: ["desktop"], forbidden: ["Gerber", "TikTok"], domains: ["desktop", "productivity"] },
  { id: "course-platform", idea: "在线教育课程平台，学生选课和学习进度", required: ["education"], forbidden: ["PCB", "FFmpeg"], domains: ["education", "web"] },
  { id: "dev-cli", idea: "给开发者用的 CLI 调试工具和 SDK", required: ["developer-tool"], forbidden: ["Shopify", "字幕"], domains: ["developer-tool"] },
  { id: "warehouse", idea: "数据仓库 ETL 和报表分析平台", required: ["data"], forbidden: ["Gerber", "TikTok"], domains: ["data"] },
  { id: "support-bot", idea: "客服自动化，把工单接到 n8n 工作流", required: ["automation"], forbidden: ["KiCad", "FFmpeg"], domains: ["automation"] },
  { id: "firmware-ota", idea: "STM32 固件 OTA 升级和设备管理后台", required: ["embedded", "firmware"], forbidden: ["TikTok", "字幕"], domains: ["embedded", "web"] },
  { id: "matching-app", idea: "同城交友 App，定位、资料和匹配聊天", required: ["matching", "chat", "location"], forbidden: ["CAD", "PCB"], domains: ["mobile"] },
  { id: "kicad-board", idea: "KiCad 画电源板，需要 BOM、ERC 和 DRC", required: ["pcb"], forbidden: ["FFmpeg", "Shopify"], domains: ["pcb"] },
];
